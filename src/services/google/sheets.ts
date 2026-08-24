import { apiFetch } from './http'

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

// --- Write serialization -----------------------------------------------------
//
// Sheets has no "update where id = x" — every write here first reads the tab to
// resolve a row index, then writes to that index. Two writes running at once
// both resolve indices against the same snapshot, so whichever lands second is
// aiming at a row that may have already moved: a delete shifts every row below
// it up by one, and the second write then overwrites (or deletes) its
// neighbour. That is how rapid-fire edits end up duplicating one record and
// destroying another.
//
// Every mutating call is chained onto a per-tab promise so each read → write
// pair completes before the next one starts.

const tabWriteQueues = new Map<string, Promise<unknown>>()

export function queueTabWrite<T>(
  spreadsheetId: string,
  tab: string,
  op: () => Promise<T>,
): Promise<T> {
  const key = `${spreadsheetId}::${tab}`
  const previous = tabWriteQueues.get(key) || Promise.resolve()
  // Run whether or not the previous write succeeded — one failure must not
  // strand every queued write behind it.
  const result = previous.then(op, op)
  tabWriteQueues.set(key, result.then(() => undefined, () => undefined))
  return result
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
  const res = await apiFetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}`, {
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

// --- Unqueued primitives (only call these from inside queueTabWrite) ---------

async function appendValues(
  spreadsheetId: string,
  tab: string,
  values: string[][],
  token: string,
): Promise<void> {
  if (values.length === 0) return
  const res = await apiFetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ values }),
    },
  )
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to append row to ${tab}: ${res.statusText}`)
}

async function writeRange(
  spreadsheetId: string,
  range: string,
  rowData: string[],
  token: string,
  tab: string,
): Promise<void> {
  const res = await apiFetch(
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

/** Row indices are 0-based data indices (header excluded). */
async function deleteDataRows(
  spreadsheetId: string,
  tab: string,
  dataIndices: number[],
  token: string,
): Promise<void> {
  if (dataIndices.length === 0) return
  const sheetId = await getSheetId(spreadsheetId, tab, token)
  // Delete from the bottom up so earlier indices stay valid as rows shift.
  const ordered = [...dataIndices].sort((a, b) => b - a)
  const res = await apiFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      requests: ordered.map((i) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: i + 1, // +1 for the header row
            endIndex: i + 2,
          },
        },
      })),
    }),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to delete row in ${tab}: ${res.statusText}`)
}

/** Returns the 0-based data index of the first matching row, or -1. */
async function findDataIndexByColumn(
  spreadsheetId: string,
  tab: string,
  columnIndex: number,
  value: string,
  token: string,
): Promise<number> {
  const res = await apiFetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}`, {
    headers: authHeaders(token),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error(`Failed to get rows from ${tab}: ${res.statusText}`)
  const data = await res.json()
  const values: string[][] = data.values || []
  // Search from row 1 onward (row 0 is header)
  for (let i = 1; i < values.length; i++) {
    if ((values[i][columnIndex] || '') === value) return i - 1
  }
  return -1
}

// --- Public writes ----------------------------------------------------------

export async function appendRow(
  spreadsheetId: string,
  tab: string,
  rowData: string[],
  token: string,
): Promise<void> {
  return queueTabWrite(spreadsheetId, tab, () => appendValues(spreadsheetId, tab, [rowData], token))
}

export async function updateRowById(
  spreadsheetId: string,
  tab: string,
  idValue: string,
  rowData: string[],
  token: string,
): Promise<void> {
  return queueTabWrite(spreadsheetId, tab, async () => {
    const dataIndex = await findDataIndexByColumn(spreadsheetId, tab, 0, idValue, token)
    if (dataIndex < 0) throw new Error(`Row with value "${idValue}" not found in ${tab}`)
    await writeRange(spreadsheetId, `${tab}!A${dataIndex + 2}`, rowData, token, tab)
  })
}

export async function updateRowByKey(
  spreadsheetId: string,
  tab: string,
  keyValue: string,
  rowData: string[],
  token: string,
): Promise<void> {
  return updateRowById(spreadsheetId, tab, keyValue, rowData, token)
}

/**
 * Update several rows in one pass: one read to resolve every index, then a
 * single values:batchUpdate. Rows whose id is gone from the sheet are skipped.
 */
export async function updateRowsById(
  spreadsheetId: string,
  tab: string,
  updates: { id: string; row: string[] }[],
  token: string,
): Promise<void> {
  if (updates.length === 0) return
  return queueTabWrite(spreadsheetId, tab, async () => {
    const { rows } = await getRows(spreadsheetId, tab, token)
    const indexById = new Map<string, number>()
    rows.forEach((row, i) => {
      if (row.id && !indexById.has(row.id)) indexById.set(row.id, i)
    })

    const data = updates
      .map(({ id, row }) => {
        const dataIndex = indexById.get(id)
        if (dataIndex === undefined) return null
        return { range: `${tab}!A${dataIndex + 2}`, values: [row] }
      })
      .filter((d): d is { range: string; values: string[][] } => d !== null)

    if (data.length === 0) return

    const res = await apiFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    })
    checkRateLimit(res)
    if (!res.ok) throw new Error(`Failed to update rows in ${tab}: ${res.statusText}`)
  })
}

/** No-op when the id is already gone, so a repeated delete stays harmless. */
export async function deleteRowById(
  spreadsheetId: string,
  tab: string,
  idValue: string,
  token: string,
): Promise<void> {
  return queueTabWrite(spreadsheetId, tab, async () => {
    const dataIndex = await findDataIndexByColumn(spreadsheetId, tab, 0, idValue, token)
    if (dataIndex < 0) return
    await deleteDataRows(spreadsheetId, tab, [dataIndex], token)
  })
}

/** Delete every row whose `column` equals `value`. */
export async function deleteRowsMatching(
  spreadsheetId: string,
  tab: string,
  column: string,
  value: string,
  token: string,
): Promise<void> {
  return queueTabWrite(spreadsheetId, tab, async () => {
    const { rows } = await getRows(spreadsheetId, tab, token)
    const indices = rows
      .map((row, i) => (row[column] === value ? i : -1))
      .filter((i) => i >= 0)
    await deleteDataRows(spreadsheetId, tab, indices, token)
  })
}

/**
 * Replace every row whose `column` equals `value` with `newRows`, as one
 * queued operation — the delete and the append can't be split apart by a
 * concurrent write.
 */
export async function replaceRowsMatching(
  spreadsheetId: string,
  tab: string,
  column: string,
  value: string,
  newRows: string[][],
  token: string,
): Promise<void> {
  return queueTabWrite(spreadsheetId, tab, async () => {
    const { rows } = await getRows(spreadsheetId, tab, token)
    const indices = rows
      .map((row, i) => (row[column] === value ? i : -1))
      .filter((i) => i >= 0)
    await deleteDataRows(spreadsheetId, tab, indices, token)
    await appendValues(spreadsheetId, tab, newRows, token)
  })
}

export async function batchGet(
  spreadsheetId: string,
  ranges: string[],
  token: string,
): Promise<string[][][]> {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')
  const res = await apiFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${params}`, {
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
  const res = await apiFetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, {
    headers: authHeaders(token),
  })
  checkRateLimit(res)
  if (!res.ok) throw new Error('Failed to get sheet metadata')
  const data = await res.json()
  const sheet = data.sheets?.find((s: { properties: { title: string } }) => s.properties.title === tab)
  if (!sheet) throw new Error(`Tab "${tab}" not found`)
  return sheet.properties.sheetId
}
