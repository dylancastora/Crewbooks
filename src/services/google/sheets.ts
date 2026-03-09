const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const DEFAULT_RETRY_AFTER = 60

let rateLimitCallback: ((retryAfterSeconds: number) => void) | null = null

export function setRateLimitCallback(cb: (retryAfterSeconds: number) => void) {
  rateLimitCallback = cb
}

function checkRateLimit(res: Response): void {
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '', 10)
    const seconds = isNaN(retryAfter) ? DEFAULT_RETRY_AFTER : retryAfter
    rateLimitCallback?.(seconds)
    throw new Error(`Rate limited by Google Sheets API. Retry after ${seconds} seconds.`)
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((h, i) => { obj[h] = row[i] || '' })
  return obj
}

export function objectToRow(headers: string[], obj: Record<string, string>): string[] {
  return headers.map((h) => obj[h] || '')
}

export async function getRows(
  spreadsheetId: string,
  tab: string,
  token: string,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}`, {
    headers: authHeaders(token),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to get rows from ${tab}: ${res.statusText}`)
  const data = await res.json()
  const values: string[][] = data.values || []
  if (values.length === 0) return { headers: [], rows: [] }
  const headers = values[0]
  const rows = values.slice(1)
    .map((row) => rowToObject(headers, row))
  return { headers, rows }
}

export async function appendRow(
  spreadsheetId: string,
  tab: string,
  rowData: string[],
  token: string,
): Promise<void> {
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ values: [rowData] }),
    },
  )
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to append row to ${tab}: ${res.statusText}`)
}

export async function updateRow(
  spreadsheetId: string,
  tab: string,
  rowIndex: number,
  rowData: string[],
  token: string,
): Promise<void> {
  const range = `${tab}!A${rowIndex + 1}` // +1 because Sheets is 1-indexed, rowIndex includes header offset
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ values: [rowData] }),
    },
  )
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to update row in ${tab}: ${res.statusText}`)
}

async function findRowIndexByColumn(
  spreadsheetId: string,
  tab: string,
  columnIndex: number,
  value: string,
  token: string,
): Promise<number> {
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}`, {
    headers: authHeaders(token),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to get rows from ${tab}: ${res.statusText}`)
  const data = await res.json()
  const values: string[][] = data.values || []
  // Search from row 1 onward (row 0 is header)
  for (let i = 1; i < values.length; i++) {
    if ((values[i][columnIndex] || '') === value) return i + 1 // 1-indexed sheet row
  }
  throw new Error(`Row with value "${value}" not found in ${tab}`)
}

export async function updateRowById(
  spreadsheetId: string,
  tab: string,
  idValue: string,
  rowData: string[],
  token: string,
): Promise<void> {
  const sheetRow = await findRowIndexByColumn(spreadsheetId, tab, 0, idValue, token)
  const range = `${tab}!A${sheetRow}`
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ values: [rowData] }),
    },
  )
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to update row in ${tab}: ${res.statusText}`)
}

export async function updateRowByKey(
  spreadsheetId: string,
  tab: string,
  keyValue: string,
  rowData: string[],
  token: string,
): Promise<void> {
  const sheetRow = await findRowIndexByColumn(spreadsheetId, tab, 0, keyValue, token)
  const range = `${tab}!A${sheetRow}`
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ values: [rowData] }),
    },
  )
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to update row in ${tab}: ${res.statusText}`)
}

export async function deleteRow(
  spreadsheetId: string,
  tab: string,
  rowIndex: number,
  token: string,
): Promise<void> {
  // First get the sheetId for this tab
  const metaRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, {
    headers: authHeaders(token),
  })
  checkRateLimit(metaRes)
  if (!metaRes.ok) throw new Error('Failed to get sheet metadata')
  const meta = await metaRes.json()
  const sheet = meta.sheets?.find((s: { properties: { title: string } }) => s.properties.title === tab)
  if (!sheet) throw new Error(`Tab "${tab}" not found`)
  const sheetId = sheet.properties.sheetId

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex, // 0-indexed, but rowIndex already accounts for header
            endIndex: rowIndex + 1,
          },
        },
      }],
    }),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to delete row in ${tab}: ${res.statusText}`)
}

export async function deleteRowById(
  spreadsheetId: string,
  tab: string,
  idValue: string,
  token: string,
): Promise<void> {
  const sheetRow = await findRowIndexByColumn(spreadsheetId, tab, 0, idValue, token)
  const sheetId = await getSheetId(spreadsheetId, tab, token)
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: sheetRow - 1, // convert 1-indexed to 0-indexed
            endIndex: sheetRow,
          },
        },
      }],
    }),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to delete row in ${tab}: ${res.statusText}`)
}

export async function batchGet(
  spreadsheetId: string,
  ranges: string[],
  token: string,
): Promise<string[][][]> {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${params}`, {
    headers: authHeaders(token),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error('Failed to batch get')
  const data = await res.json()
  return (data.valueRanges || []).map((vr: { values?: string[][] }) => vr.values || [])
}

export async function getSheetId(
  spreadsheetId: string,
  tab: string,
  token: string,
): Promise<number> {
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, {
    headers: authHeaders(token),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error('Failed to get sheet metadata')
  const data = await res.json()
  const sheet = data.sheets?.find((s: { properties: { title: string } }) => s.properties.title === tab)
  if (!sheet) throw new Error(`Tab "${tab}" not found`)
  return sheet.properties.sheetId
}
