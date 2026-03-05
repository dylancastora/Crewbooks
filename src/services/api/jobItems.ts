import { getRows, appendRow, getSheetId } from '../google/sheets'
import type { JobItem } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

const ITEM_HEADERS = ['id', 'jobId', 'jobNumber', 'type', 'description', 'date', 'quantity', 'rate', 'taxable', 'sortOrder', 'amount']

function rowToItem(row: Record<string, string>): JobItem {
  return {
    ...row,
    quantity: parseFloat(row.quantity) || 0,
    rate: parseFloat(row.rate) || 0,
    taxable: row.taxable === 'true',
    sortOrder: parseInt(row.sortOrder) || 0,
    amount: parseFloat(row.amount) || 0,
  } as unknown as JobItem
}

export async function getJobItems(spreadsheetId: string, jobId: string, token: string): Promise<JobItem[]> {
  const { rows } = await getRows(spreadsheetId, 'JobItems', token)
  return rows.filter((r) => r.jobId === jobId).map(rowToItem)
}

export async function getAllJobItems(spreadsheetId: string, token: string): Promise<JobItem[]> {
  const { rows } = await getRows(spreadsheetId, 'JobItems', token)
  return rows.map(rowToItem)
}

export async function setJobItems(
  spreadsheetId: string,
  jobId: string,
  jobNumber: string,
  items: Omit<JobItem, 'id'>[],
  token: string,
): Promise<JobItem[]> {
  // Delete all existing items for this job
  const { rows } = await getRows(spreadsheetId, 'JobItems', token)
  const existingIndices = rows
    .map((r, i) => r.jobId === jobId ? i : -1)
    .filter((i) => i >= 0)
    .reverse() // delete from bottom to preserve indices

  const sheetId = await getSheetId(spreadsheetId, 'JobItems', token)
  const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

  if (existingIndices.length > 0) {
    const deleteRequests = existingIndices.map((i) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: i + 1, // +1 for header
          endIndex: i + 2,
        },
      },
    }))
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: deleteRequests }),
    })
  }

  // Write new items
  const newItems: JobItem[] = items.map((item, idx) => ({
    ...item,
    id: generateId(),
    jobId,
    jobNumber,
    sortOrder: idx,
    amount: item.quantity * item.rate,
  } as JobItem))

  for (const item of newItems) {
    const obj = item as unknown as Record<string, unknown>
    const row = ITEM_HEADERS.map((h) => String(obj[h] ?? ''))
    await appendRow(spreadsheetId, 'JobItems', row, token)
  }

  return newItems
}
