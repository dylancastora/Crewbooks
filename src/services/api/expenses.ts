import { getRows, appendRow, updateRowById, updateRowsById, deleteRowById } from '../google/sheets'
import type { Expense } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

const EXPENSE_HEADERS = ['id', 'jobId', 'clientId', 'description', 'amount', 'date', 'category', 'receiptFileId', 'receiptFileName', 'billed', 'createdAt', 'updatedAt']

function rowToExpense(row: Record<string, string>): Expense {
  return {
    ...row,
    amount: parseFloat(row.amount) || 0,
    billed: row.billed === 'true',
  } as unknown as Expense
}

export async function getExpenses(spreadsheetId: string, token: string): Promise<Expense[]> {
  const { rows } = await getRows(spreadsheetId, 'Expenses', token)
  return rows.map(rowToExpense)
}

export async function getExpensesForJob(spreadsheetId: string, jobId: string, token: string): Promise<Expense[]> {
  const all = await getExpenses(spreadsheetId, token)
  return all.filter((e) => e.jobId === jobId)
}

export async function createExpense(
  spreadsheetId: string,
  data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  token: string,
): Promise<Expense> {
  const expense: Expense = {
    ...data,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  }
  const obj = expense as unknown as Record<string, unknown>
  const row = EXPENSE_HEADERS.map((h) => String(obj[h] ?? ''))
  await appendRow(spreadsheetId, 'Expenses', row, token)
  return expense
}

function expenseToRow(expense: Expense): string[] {
  const obj = expense as unknown as Record<string, unknown>
  return EXPENSE_HEADERS.map((h) => String(obj[h] ?? ''))
}

export async function updateExpense(
  spreadsheetId: string,
  expense: Expense,
  token: string,
): Promise<void> {
  expense.updatedAt = now()
  await updateRowById(spreadsheetId, 'Expenses', expense.id, expenseToRow(expense), token)
}

/** Write several expenses in one request — used when a job's links change. */
export async function updateExpenses(
  spreadsheetId: string,
  expenses: Expense[],
  token: string,
): Promise<Expense[]> {
  if (expenses.length === 0) return []
  const stamped = expenses.map((e) => ({ ...e, updatedAt: now() }))
  await updateRowsById(
    spreadsheetId,
    'Expenses',
    stamped.map((e) => ({ id: e.id, row: expenseToRow(e) })),
    token,
  )
  return stamped
}

/**
 * Detach a deleted job's expenses instead of deleting them — the spend still
 * happened and still belongs to the client, so the record survives the job and
 * goes back to unbilled so it can be billed to another one.
 */
export async function unlinkExpensesFromJob(
  spreadsheetId: string,
  jobId: string,
  token: string,
): Promise<void> {
  const linked = (await getExpenses(spreadsheetId, token)).filter((e) => e.jobId === jobId)
  if (linked.length === 0) return
  await updateExpenses(
    spreadsheetId,
    linked.map((e) => ({ ...e, jobId: '', billed: false })),
    token,
  )
}

export async function deleteExpense(
  spreadsheetId: string,
  expenseId: string,
  token: string,
): Promise<void> {
  await deleteRowById(spreadsheetId, 'Expenses', expenseId, token)
}
