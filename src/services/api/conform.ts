import { getRows } from '../google/sheets'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

interface MigrationContext {
  communications: Record<string, string>[]
}

interface SchemaMigration {
  tab: string
  column: string
  afterColumn: string
  defaultValue: string | ((row: Record<string, string>, context: MigrationContext) => string)
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
]

export async function conformSchema(spreadsheetId: string, token: string): Promise<void> {
  // Group migrations by tab
  const tabMigrations = new Map<string, SchemaMigration[]>()
  for (const m of migrations) {
    const list = tabMigrations.get(m.tab) || []
    list.push(m)
    tabMigrations.set(m.tab, list)
  }

  // Check each tab for missing columns
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

  // No work needed
  if (tabMissing.size === 0) return

  // Check if any migration needs cross-tab context
  let context: MigrationContext = { communications: [] }
  const needsComms = Array.from(tabMissing.values()).flat().some(
    (m) => typeof m.defaultValue === 'function',
  )
  if (needsComms) {
    const commData = await getRows(spreadsheetId, 'Communications', token)
    context = { communications: commData.rows }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  for (const [tab, missing] of tabMissing) {
    const data = tabData.get(tab)!
    const newHeaders = [...data.headers]

    // Insert missing columns in proper position
    for (const m of missing) {
      const afterIdx = newHeaders.indexOf(m.afterColumn)
      if (afterIdx >= 0) {
        newHeaders.splice(afterIdx + 1, 0, m.column)
      } else {
        newHeaders.push(m.column)
      }
    }

    // Build new rows with default values
    const newRows = data.rows.map((row) => {
      const newRow = { ...row }
      for (const m of missing) {
        newRow[m.column] = typeof m.defaultValue === 'function'
          ? m.defaultValue(newRow, context)
          : m.defaultValue
      }
      return newHeaders.map((h) => newRow[h] || '')
    })

    // Batch update: headers + all rows
    const allValues = [newHeaders, ...newRows]
    const range = `${tab}!A1`
    await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ values: allValues }),
      },
    )
  }
}
