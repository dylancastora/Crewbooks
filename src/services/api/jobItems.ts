import { getRows, replaceRowsMatching } from '../google/sheets'
import { mileageDescription, lineItemAmount } from '../../utils/lineItems'
import { ItemType } from '../../types'
import type { JobItem } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

const ITEM_HEADERS = ['id', 'jobId', 'jobNumber', 'type', 'description', 'days', 'quantity', 'rate', 'taxable', 'sortOrder', 'amount']

function rowToItem(row: Record<string, string>): JobItem {
  const days = parseFloat(row.days) || 0
  const quantity = parseFloat(row.quantity) || 0
  const rate = parseFloat(row.rate) || 0
  const type = row.type

  return {
    ...row,
    days,
    quantity,
    rate,
    taxable: row.taxable === 'true',
    sortOrder: parseInt(row.sortOrder) || 0,
    // days/quantity/rate are the hand-editable columns; amount and the mileage
    // label are app-managed restatements of them. Recomputing on read is what
    // lets a rate corrected in the spreadsheet reach the totals and the
    // invoice, instead of leaving a row that contradicts itself.
    amount: lineItemAmount({ type, days, quantity, rate }),
    ...(type === ItemType.Mileage ? { description: mileageDescription(quantity, rate) } : {}),
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
  const newItems: JobItem[] = items.map((item, idx) => ({
    ...item,
    id: generateId(),
    jobId,
    jobNumber,
    sortOrder: idx,
    amount: item.amount,
  } as JobItem))

  const rows = newItems.map((item) => {
    const obj = item as unknown as Record<string, unknown>
    return ITEM_HEADERS.map((h) => String(obj[h] ?? ''))
  })

  // Swap this job's rows out for the new set as a single serialized operation —
  // splitting the delete from the append lets a concurrent save duplicate items.
  await replaceRowsMatching(spreadsheetId, 'JobItems', 'jobId', jobId, rows, token)

  return newItems
}
