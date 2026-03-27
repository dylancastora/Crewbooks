import { getRows, appendRow, getSheetId } from '../google/sheets'
import { DEFAULT_SETTINGS } from './init'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// Current version — bump when formatting/protection config changes
const SHEET_FORMAT_VERSION = '1'

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

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
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

// --- Column deletions ---

async function conformColumnDeletions(spreadsheetId: string, token: string): Promise<void> {
  for (const { tab, column } of columnDeletions) {
    const { headers } = await getRows(spreadsheetId, tab, token)
    const colIdx = headers.indexOf(column)
    if (colIdx < 0) continue // already deleted

    const sheetId = await getSheetId(spreadsheetId, tab, token)
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: colIdx, endIndex: colIdx + 1 },
          },
        }],
      }),
    })
  }
}

// --- Formatting: header styles + locked column grey text ---

async function conformFormatting(
  spreadsheetId: string,
  token: string,
  sheetMap: Record<string, number>,
): Promise<void> {
  const requests: unknown[] = []

  for (const tab of ALL_TABS) {
    const sheetId = sheetMap[tab]
    if (sheetId == null) continue

    // Bold white text on dark blue background for header row
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

    // Auto-fit column widths to content
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS' },
      },
    })

    // Grey text for locked columns (rows 1+)
    const lockedCols = LOCKED_COLUMNS[tab]
    if (!lockedCols) continue

    const { headers } = await getRows(spreadsheetId, tab, token)
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

  if (requests.length > 0) {
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ requests }),
    })
  }
}

// --- Protections: clear old warningOnly ranges, add new ones ---

async function conformProtections(
  spreadsheetId: string,
  token: string,
  sheetMap: Record<string, number>,
): Promise<void> {
  // Read existing protected ranges
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}?fields=sheets(properties,protectedRanges)`,
    { headers: authHeaders(token) },
  )
  if (!res.ok) throw new Error('Failed to get sheet metadata for protections')
  const data = await res.json()

  const requests: unknown[] = []

  // Delete all existing warningOnly protected ranges
  for (const sheet of data.sheets || []) {
    for (const pr of sheet.protectedRanges || []) {
      if (pr.warningOnly) {
        requests.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } })
      }
    }
  }

  // Add header row protection for every tab
  for (const tab of ALL_TABS) {
    const sheetId = sheetMap[tab]
    if (sheetId == null) continue
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          description: `Header row: ${tab}`,
          warningOnly: true,
        },
      },
    })
  }

  // Add column protections
  for (const tab of ALL_TABS) {
    const sheetId = sheetMap[tab]
    if (sheetId == null) continue
    const lockedCols = LOCKED_COLUMNS[tab]
    if (!lockedCols) continue

    const { headers } = await getRows(spreadsheetId, tab, token)
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

  if (requests.length > 0) {
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ requests }),
    })
  }
}

// --- Phone number sanitization ---

async function conformPhoneNumbers(spreadsheetId: string, token: string): Promise<void> {
  const { headers, rows } = await getRows(spreadsheetId, 'Contacts', token)
  const phoneIdx = headers.indexOf('phone')
  if (phoneIdx < 0) return

  let dirty = false
  const cleanedRows = rows.map((row) => {
    const phone = row.phone || ''
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned !== phone) dirty = true
    return headers.map((h) => h === 'phone' ? cleaned : (row[h] || ''))
  })

  if (!dirty) return

  // Rewrite all data rows (skip header)
  const range = `Contacts!A2`
  await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ values: cleanedRows }),
    },
  )
}

// --- Helpers ---

async function getSheetMap(spreadsheetId: string, token: string): Promise<Record<string, number>> {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`,
    { headers: authHeaders(token) },
  )
  if (!res.ok) throw new Error('Failed to get sheet metadata')
  const data = await res.json()
  const map: Record<string, number> = {}
  for (const sheet of data.sheets || []) {
    map[sheet.properties.title] = sheet.properties.sheetId
  }
  return map
}

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
  // 1. Ensure all default settings exist
  await conformSettings(spreadsheetId, token)

  // 2. Column-add migrations
  await conformColumns(spreadsheetId, token)

  // 3. Column deletions
  await conformColumnDeletions(spreadsheetId, token)

  // 4-6. Formatting, protections, phone sanitization (gated by version flag)
  const currentVersion = await getFormatVersion(spreadsheetId, token)
  if (currentVersion !== SHEET_FORMAT_VERSION) {
    const sheetMap = await getSheetMap(spreadsheetId, token)
    await conformFormatting(spreadsheetId, token, sheetMap)
    await conformProtections(spreadsheetId, token, sheetMap)
    await conformPhoneNumbers(spreadsheetId, token)
    await setFormatVersion(spreadsheetId, token, SHEET_FORMAT_VERSION)
  }
}
