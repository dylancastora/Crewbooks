import { getRows, appendRow, updateRow, deleteRow } from '../google/sheets'
import type { Expense } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

const EXPENSE_HEADERS = ['id', 'jobId', 'clientId', 'description', 'amount', 'date', 'category', 'receiptFileId', 'receiptFileName', 'createdAt', 'updatedAt']

function rowToExpense(row: Record<string, string>): Expense {
  return {
    ...row,
    amount: parseFloat(row.amount) || 0,
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

export async function updateExpense(
  spreadsheetId: string,
  expense: Expense,
  token: string,
): Promise<void> {
  const { rows } = await getRows(spreadsheetId, 'Expenses', token)
  const idx = rows.findIndex((r) => r.id === expense.id)
  if (idx < 0) throw new Error('Expense not found')
  expense.updatedAt = now()
  const obj = expense as unknown as Record<string, unknown>
  const row = EXPENSE_HEADERS.map((h) => String(obj[h] ?? ''))
  await updateRow(spreadsheetId, 'Expenses', idx + 2, row, token)
}

export async function deleteExpense(
  spreadsheetId: string,
  expenseId: string,
  token: string,
): Promise<void> {
  const { rows } = await getRows(spreadsheetId, 'Expenses', token)
  const idx = rows.findIndex((r) => r.id === expenseId)
  if (idx < 0) throw new Error('Expense not found')
  await deleteRow(spreadsheetId, 'Expenses', idx + 1, token)
}
