import { getRows, appendRow, batchGet } from '../google/sheets'
import { DEFAULT_SETTINGS } from './init'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// Bump when formatting/protection/validation config changes
const SHEET_FORMAT_VERSION = '4'

interface MigrationContext {
  communications: Record<string, string>[]
  jobs: Record<string, string>[]
}

interface SchemaMigration {
  tab: string
  column: string
  afterColumn: string
  defaultValue: string | ((row: Record<string, string>, context: MigrationContext) => string)
}

interface ColumnDeletion {
  tab: string
  column: string
}

const migrations: SchemaMigration[] = [
  {
    tab: 'Jobs',
    column: 'paymentWindow',
    afterColumn: 'paymentTerms',
    defaultValue: '30',
  },
  {
    tab: 'Jobs',
    column: 'dueDate',
    afterColumn: 'paymentWindow',
    defaultValue: (row, ctx) => {
      if (row.status !== 'invoiced') return ''
      const jobComms = ctx.communications
        .filter((c) => c.jobId === row.id && c.type === 'invoice')
        .sort((a, b) => (b.dateSent || '').localeCompare(a.dateSent || ''))
      const latest = jobComms[0]
      if (!latest) return ''
      const sent = new Date(latest.dateSent)
      if (isNaN(sent.getTime())) return ''
      const window = parseInt(row.paymentWindow) || 30
      sent.setDate(sent.getDate() + window)
      return sent.toISOString().split('T')[0]
    },
  },
  {
    tab: 'JobItems',
    column: 'days',
    afterColumn: 'description',
    defaultValue: (row, ctx) => {
      if (row.type === 'mileage') return '0'
      const job = ctx.jobs.find((j) => j.id === row.jobId)
      if (!job || !job.shootDates) return '1'
      return String(job.shootDates.split(',').map((d) => d.trim()).filter(Boolean).length || 1)
    },
  },
]

const columnDeletions: ColumnDeletion[] = [
  { tab: 'JobItems', column: 'date' },
]

// Columns that should be protected (warningOnly) and styled grey
const LOCKED_COLUMNS: Record<string, string[]> = {
  Clients: ['id', 'createdAt', 'updatedAt'],
  Contacts: ['id', 'clientId', 'createdAt', 'updatedAt'],
  Labor: ['id', 'createdAt', 'updatedAt'],
  Equipment: ['id', 'createdAt', 'updatedAt', 'unit'],
  Jobs: ['id', 'jobNumber', 'clientId', 'title', 'status', 'contactIds', 'shootDates', 'cancelled', 'createdAt', 'updatedAt'],
  JobItems: ['id', 'jobId', 'jobNumber', 'type', 'sortOrder', 'amount'],
  Expenses: ['id', 'jobId', 'clientId', 'receiptFileId', 'receiptFileName', 'createdAt', 'updatedAt'],
  Communications: ['id', 'jobId', 'type', 'dateSent', 'recipients', 'amount', 'subject', 'notes', 'isResend', 'priorCommunicationId'],
  Settings: ['key'],
}

const ALL_TABS = ['Clients', 'Contacts', 'Labor', 'Equipment', 'Jobs', 'JobItems', 'Expenses', 'Communications', 'Settings']

// --- Data validation rule definitions ---

type ValidationRule =
  | { tab: string; column: string; type: 'enum'; values: string[] }
  | { tab: string; column: string; type: 'number' }
  | { tab: string; column: string; type: 'formula'; formula: string }

function enumFormula(values: string[]): string {
  const s = 'INDIRECT(ADDRESS(ROW(),COLUMN()))'
  const options = values.map((v) => `${s}="${v}"`).join(',')
  return `=OR(${options},${s}="")`
}

const UUID_RE = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
const NUMBER_RE = '^-?\\d+\\.?\\d*$'
const DATE_RE = '^\\d{4}-\\d{2}-\\d{2}$'
const DATES_CSV_RE = '^\\d{4}-\\d{2}-\\d{2}(,\\s*\\d{4}-\\d{2}-\\d{2})*$'
const TIMESTAMP_RE = '^\\d{4}-\\d{2}-\\d{2}T'
const UUIDS_CSV_RE = '^[0-9a-f-]+(,[0-9a-f-]+)*$'

function selfRefFormula(pattern: string): string {
  const s = 'INDIRECT(ADDRESS(ROW(),COLUMN()))'
  return `=OR(REGEXMATCH(${s},"${pattern}"),${s}="")`
}

const VALIDATION_RULES: ValidationRule[] = [
  // Booleans (as text dropdowns)
  { tab: 'Jobs', column: 'cancelled', type: 'enum', values: ['true', 'false'] },
  { tab: 'JobItems', column: 'taxable', type: 'enum', values: ['true', 'false'] },
  { tab: 'Expenses', column: 'billed', type: 'enum', values: ['true', 'false'] },
  { tab: 'Communications', column: 'isResend', type: 'enum', values: ['true', 'false'] },
  { tab: 'Labor', column: 'taxable', type: 'enum', values: ['true', 'false'] },
  { tab: 'Labor', column: 'isActive', type: 'enum', values: ['true', 'false'] },
  { tab: 'Equipment', column: 'taxable', type: 'enum', values: ['true', 'false'] },
  { tab: 'Equipment', column: 'isActive', type: 'enum', values: ['true', 'false'] },
  // Enums
  { tab: 'Jobs', column: 'status', type: 'enum', values: ['draft', 'quoted', 'approved', 'invoiced', 'paid'] },
  { tab: 'JobItems', column: 'type', type: 'enum', values: ['labor', 'equipment', 'mileage', 'custom'] },
  { tab: 'Expenses', column: 'category', type: 'enum', values: ['Fuel', 'Meals', 'Equipment', 'Supplies', 'Rentals', 'Parking', 'Other'] },
  { tab: 'Communications', column: 'type', type: 'enum', values: ['quote', 'invoice'] },
  { tab: 'Labor', column: 'unit', type: 'enum', values: ['hour', 'day', 'week', 'flat'] },
  { tab: 'Equipment', column: 'unit', type: 'enum', values: ['hour', 'day', 'week', 'flat'] },
  // Numbers
  ...['taxRate', 'paymentWindow'].map((c): ValidationRule => ({ tab: 'Jobs', column: c, type: 'number' })),
  ...['days', 'quantity', 'rate', 'amount', 'sortOrder'].map((c): ValidationRule => ({ tab: 'JobItems', column: c, type: 'number' })),
  { tab: 'Expenses', column: 'amount', type: 'number' },
  { tab: 'Communications', column: 'amount', type: 'number' },
  { tab: 'Labor', column: 'rate', type: 'number' },
  { tab: 'Equipment', column: 'rate', type: 'number' },
  // UUIDs
  ...['Clients', 'Contacts', 'Labor', 'Equipment', 'Jobs', 'JobItems', 'Expenses', 'Communications'].map(
    (tab): ValidationRule => ({ tab, column: 'id', type: 'formula', formula: selfRefFormula(UUID_RE) }),
  ),
  { tab: 'Jobs', column: 'clientId', type: 'formula', formula: selfRefFormula(UUID_RE) },
  { tab: 'Contacts', column: 'clientId', type: 'formula', formula: selfRefFormula(UUID_RE) },
  { tab: 'JobItems', column: 'jobId', type: 'formula', formula: selfRefFormula(UUID_RE) },
  { tab: 'Expenses', column: 'jobId', type: 'formula', formula: selfRefFormula(UUID_RE) },
  { tab: 'Expenses', column: 'clientId', type: 'formula', formula: selfRefFormula(UUID_RE) },
  { tab: 'Communications', column: 'jobId', type: 'formula', formula: selfRefFormula(UUID_RE) },
  { tab: 'Communications', column: 'priorCommunicationId', type: 'formula', formula: selfRefFormula(UUID_RE) },
  { tab: 'Jobs', column: 'contactIds', type: 'formula', formula: selfRefFormula(UUIDS_CSV_RE) },
  // Dates
  { tab: 'Jobs', column: 'dueDate', type: 'formula', formula: selfRefFormula(DATE_RE) },
  { tab: 'Expenses', column: 'date', type: 'formula', formula: selfRefFormula(DATE_RE) },
  { tab: 'Communications', column: 'dateSent', type: 'formula', formula: selfRefFormula(TIMESTAMP_RE) },
  { tab: 'Jobs', column: 'shootDates', type: 'formula', formula: selfRefFormula(DATES_CSV_RE) },
  // Timestamps
  ...['Clients', 'Contacts', 'Labor', 'Equipment', 'Jobs', 'Expenses'].flatMap(
    (tab) => ['createdAt', 'updatedAt'].map((col): ValidationRule => ({
      tab, column: col, type: 'formula', formula: selfRefFormula(TIMESTAMP_RE),
    })),
  ),
]

// --- Helpers ---

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Fetch sheetId map + existing protected ranges in one call */
async function getSheetMeta(spreadsheetId: string, token: string): Promise<{
  sheetMap: Record<string, number>
  existingProtections: { protectedRangeId: number; warningOnly: boolean }[]
}> {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}?fields=sheets(properties,protectedRanges)`,
    { headers: authHeaders(token) },
  )
  if (!res.ok) throw new Error('Failed to get sheet metadata')
  const data = await res.json()
  const sheetMap: Record<string, number> = {}
  const existingProtections: { protectedRangeId: number; warningOnly: boolean }[] = []
  for (const sheet of data.sheets || []) {
    sheetMap[sheet.properties.title] = sheet.properties.sheetId
    for (const pr of sheet.protectedRanges || []) {
      existingProtections.push({ protectedRangeId: pr.protectedRangeId, warningOnly: pr.warningOnly })
    }
  }
  return { sheetMap, existingProtections }
}

/** Read all tab headers in a single batchGet call */
async function getAllHeaders(spreadsheetId: string, token: string): Promise<Map<string, string[]>> {
  const ranges = ALL_TABS.map((tab) => `${tab}!1:1`)
  const results = await batchGet(spreadsheetId, ranges, token)
  const headerMap = new Map<string, string[]>()
  ALL_TABS.forEach((tab, i) => {
    headerMap.set(tab, results[i]?.[0] || [])
  })
  return headerMap
}

function buildValidationCondition(rule: ValidationRule): unknown {
  if (rule.type === 'enum') {
    return { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: enumFormula(rule.values) }] }
  } else if (rule.type === 'number') {
    const s = 'INDIRECT(ADDRESS(ROW(),COLUMN()))'
    return { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=OR(REGEXMATCH(TO_TEXT(${s}),"${NUMBER_RE}"),${s}="")` }] }
  } else {
    return { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: rule.formula }] }
  }
}

// --- Settings conformance ---

async function conformSettings(spreadsheetId: string, token: string): Promise<void> {
  const { rows } = await getRows(spreadsheetId, 'Settings', token)
  const existingKeys = new Set(rows.map((r) => r.key))
  const missing = DEFAULT_SETTINGS.filter(([key]) => !existingKeys.has(key))
  for (const [key, value] of missing) {
    await appendRow(spreadsheetId, 'Settings', [key, value], token)
  }
}

// --- Column-add migrations ---

async function conformColumns(spreadsheetId: string, token: string): Promise<void> {
  const tabMigrations = new Map<string, SchemaMigration[]>()
  for (const m of migrations) {
    const list = tabMigrations.get(m.tab) || []
    list.push(m)
    tabMigrations.set(m.tab, list)
  }

  const tabData = new Map<string, { headers: string[]; rows: Record<string, string>[] }>()
  const tabMissing = new Map<string, SchemaMigration[]>()

  for (const [tab, migs] of tabMigrations) {
    const data = await getRows(spreadsheetId, tab, token)
    tabData.set(tab, data)
    const missing = migs.filter((m) => !data.headers.includes(m.column))
    if (missing.length > 0) {
      tabMissing.set(tab, missing)
    }
  }

  if (tabMissing.size === 0) return

  let context: MigrationContext = { communications: [], jobs: [] }
  const needsContext = Array.from(tabMissing.values()).flat().some(
    (m) => typeof m.defaultValue === 'function',
  )
  if (needsContext) {
    const [commData, jobsData] = await Promise.all([
      getRows(spreadsheetId, 'Communications', token),
      getRows(spreadsheetId, 'Jobs', token),
    ])
    context = { communications: commData.rows, jobs: jobsData.rows }
  }

  const headers = authHeaders(token)

  for (const [tab, missing] of tabMissing) {
    const data = tabData.get(tab)!
    const newHeaders = [...data.headers]

    for (const m of missing) {
      const afterIdx = newHeaders.indexOf(m.afterColumn)
      if (afterIdx >= 0) {
        newHeaders.splice(afterIdx + 1, 0, m.column)
      } else {
        newHeaders.push(m.column)
      }
    }

    const newRows = data.rows.map((row) => {
      const newRow = { ...row }
      for (const m of missing) {
        newRow[m.column] = typeof m.defaultValue === 'function'
          ? m.defaultValue(newRow, context)
          : m.defaultValue
      }
      return newHeaders.map((h) => newRow[h] || '')
    })

    const allValues = [newHeaders, ...newRows]
    const range = `${tab}!A1`
    await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      { method: 'PUT', headers, body: JSON.stringify({ values: allValues }) },
    )
  }
}

// --- Combined formatting, protections, validation, column deletions ---

async function conformSheetPresentation(
  spreadsheetId: string,
  token: string,
): Promise<void> {
  // 1. Get sheet metadata + existing protections (1 API call)
  const { sheetMap, existingProtections } = await getSheetMeta(spreadsheetId, token)

  // 2. Read all tab headers (1 API call via batchGet)
  const headerMap = await getAllHeaders(spreadsheetId, token)

  const requests: unknown[] = []

  // --- Column deletions (must come first, before formatting references columns) ---
  for (const { tab, column } of columnDeletions) {
    const headers = headerMap.get(tab)
    if (!headers) continue
    const colIdx = headers.indexOf(column)
    if (colIdx < 0) continue
    const sheetId = sheetMap[tab]
    if (sheetId == null) continue
    requests.push({
      deleteDimension: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: colIdx, endIndex: colIdx + 1 },
      },
    })
    // Update cached headers to reflect deletion
    headers.splice(colIdx, 1)
  }

  // --- Header formatting ---
  for (const tab of ALL_TABS) {
    const sheetId = sheetMap[tab]
    if (sheetId == null) continue

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.12, green: 0.24, blue: 0.43 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    })

    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS' },
      },
    })
  }

  // --- Grey text for locked columns ---
  for (const tab of ALL_TABS) {
    const sheetId = sheetMap[tab]
    if (sheetId == null) continue
    const lockedCols = LOCKED_COLUMNS[tab]
    if (!lockedCols) continue
    const headers = headerMap.get(tab) || []

    for (const col of lockedCols) {
      const colIdx = headers.indexOf(col)
      if (colIdx < 0) continue
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 } },
            },
          },
          fields: 'userEnteredFormat(textFormat.foregroundColor)',
        },
      })
    }
  }

  // --- Protections: delete old, add new ---
  for (const pr of existingProtections) {
    if (pr.warningOnly) {
      requests.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } })
    }
  }

  for (const tab of ALL_TABS) {
    const sheetId = sheetMap[tab]
    if (sheetId == null) continue

    // Protect header row
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          description: `Header row: ${tab}`,
          warningOnly: true,
        },
      },
    })

    // Protect locked columns
    const lockedCols = LOCKED_COLUMNS[tab]
    if (!lockedCols) continue
    const headers = headerMap.get(tab) || []

    for (const col of lockedCols) {
      const colIdx = headers.indexOf(col)
      if (colIdx < 0) continue
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
            description: `Locked column: ${tab}.${col}`,
            warningOnly: true,
          },
        },
      })
    }
  }

  // --- Data validation ---
  for (const rule of VALIDATION_RULES) {
    const sheetId = sheetMap[rule.tab]
    if (sheetId == null) continue
    const headers = headerMap.get(rule.tab) || []
    const colIdx = headers.indexOf(rule.column)
    if (colIdx < 0) continue

    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
        rule: { condition: buildValidationCondition(rule), strict: true, showCustomUi: true },
      },
    })
  }

  // 3. Send everything in one batchUpdate (1 API call)
  if (requests.length > 0) {
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ requests }),
    })
  }
}

// --- Format version helpers ---

async function getFormatVersion(spreadsheetId: string, token: string): Promise<string> {
  const { rows } = await getRows(spreadsheetId, 'Settings', token)
  return rows.find((r) => r.key === '_sheetFormatVersion')?.value || ''
}

async function setFormatVersion(spreadsheetId: string, token: string, version: string): Promise<void> {
  const { rows } = await getRows(spreadsheetId, 'Settings', token)
  const exists = rows.some((r) => r.key === '_sheetFormatVersion')
  if (exists) {
    const { updateRowByKey } = await import('../google/sheets')
    await updateRowByKey(spreadsheetId, 'Settings', '_sheetFormatVersion', ['_sheetFormatVersion', version], token)
  } else {
    await appendRow(spreadsheetId, 'Settings', ['_sheetFormatVersion', version], token)
  }
}

// --- Main entry point ---

export async function conformSchema(spreadsheetId: string, token: string): Promise<void> {
  // 1. Ensure all default settings exist (1 read + N appends for missing)
  await conformSettings(spreadsheetId, token)

  // 2. Column-add migrations (reads only affected tabs)
  await conformColumns(spreadsheetId, token)

  // 3. Formatting, protections, validation, column deletions (gated by version)
  const currentVersion = await getFormatVersion(spreadsheetId, token)
  if (currentVersion !== SHEET_FORMAT_VERSION) {
    // 1 metadata call + 1 batchGet + 1 batchUpdate = 3 API calls
    await conformSheetPresentation(spreadsheetId, token)
    // Version update: 1 read + 1 write
    await setFormatVersion(spreadsheetId, token, SHEET_FORMAT_VERSION)
  }
}
