import { getRows, appendRow, updateRowById, getSheetId } from '../google/sheets'
import { JobStatus } from '../../types'
import type { Job, JobItem, Expense, JobTotals, Settings } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

const JOB_HEADERS = ['id', 'jobNumber', 'clientId', 'title', 'status', 'contactIds', 'shootDates', 'taxRate', 'paymentTerms', 'notes', 'cancelled', 'createdAt', 'updatedAt']

function rowToJob(row: Record<string, string>): Job {
  return {
    ...row,
    taxRate: parseFloat(row.taxRate) || 0,
    cancelled: row.cancelled === 'true',
  } as unknown as Job
}

export function generateJobNumber(existingJobs: Job[], settings: Settings): string {
  const startNumber = parseInt(settings.invoiceStartNumber || '1') || 1
  if (existingJobs.length === 0) return String(startNumber)
  const maxNumber = Math.max(
    ...existingJobs.map((j) => parseInt(j.jobNumber) || 0),
    startNumber - 1,
  )
  return String(maxNumber + 1)
}

export async function getJobs(spreadsheetId: string, token: string): Promise<Job[]> {
  const { rows } = await getRows(spreadsheetId, 'Jobs', token)
  return rows.map(rowToJob)
}

export async function createJob(
  spreadsheetId: string,
  data: Partial<Job>,
  settings: Settings,
  existingJobs: Job[],
  token: string,
): Promise<Job> {
  const job: Job = {
    id: generateId(),
    jobNumber: data.jobNumber || generateJobNumber(existingJobs, settings),
    clientId: data.clientId || '',
    title: data.title || '',
    status: JobStatus.Draft,
    contactIds: data.contactIds || '',
    shootDates: data.shootDates || '',
    taxRate: data.taxRate ?? 0,
    paymentTerms: data.paymentTerms || settings.defaultPaymentTerms || 'Net 30',
    notes: data.notes || '',
    cancelled: false,
    createdAt: now(),
    updatedAt: now(),
  }
  const obj = job as unknown as Record<string, unknown>
  const row = JOB_HEADERS.map((h) => String(obj[h] ?? ''))
  await appendRow(spreadsheetId, 'Jobs', row, token)
  return job
}

export async function updateJob(
  spreadsheetId: string,
  job: Job,
  token: string,
): Promise<void> {
  job.updatedAt = now()
  const obj = job as unknown as Record<string, unknown>
  const row = JOB_HEADERS.map((h) => String(obj[h] ?? ''))
  await updateRowById(spreadsheetId, 'Jobs', job.id, row, token)
}

export async function deleteJob(
  spreadsheetId: string,
  jobId: string,
  token: string,
): Promise<void> {
  const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Gather all row indices to delete across tabs
  const tabs = ['Jobs', 'JobItems', 'Expenses', 'Communications'] as const
  const deleteBatch: Array<{ tab: string; indices: number[] }> = []

  for (const tab of tabs) {
    const { rows } = await getRows(spreadsheetId, tab, token)
    const field = tab === 'Jobs' ? 'id' : 'jobId'
    const indices = rows
      .map((r, i) => r[field] === jobId ? i : -1)
      .filter((i) => i >= 0)
      .reverse()
    if (indices.length > 0) {
      deleteBatch.push({ tab, indices })
    }
  }

  for (const { tab, indices } of deleteBatch) {
    const sheetId = await getSheetId(spreadsheetId, tab, token)
    const requests = indices.map((i) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: i + 1,
          endIndex: i + 2,
        },
      },
    }))
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests }),
    })
  }
}

export function calculateTotals(items: JobItem[], expenses: Expense[], taxRate: number): JobTotals {
  let laborSubtotal = 0
  let equipmentSubtotal = 0
  let mileageSubtotal = 0
  let customSubtotal = 0
  let taxableSubtotal = 0

  for (const item of items) {
    const amount = item.amount
    switch (item.type) {
      case 'labor': laborSubtotal += amount; break
      case 'equipment': equipmentSubtotal += amount; break
      case 'mileage': mileageSubtotal += amount; break
      case 'custom': customSubtotal += amount; break
      default: laborSubtotal += amount; break
    }
    if (item.taxable) taxableSubtotal += amount
  }

  const expensesSubtotal = expenses.reduce((sum, e) => sum + e.amount, 0)
  const taxAmount = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100
  const total = laborSubtotal + equipmentSubtotal + mileageSubtotal + customSubtotal + expensesSubtotal + taxAmount

  return { laborSubtotal, equipmentSubtotal, mileageSubtotal, customSubtotal, expensesSubtotal, taxableSubtotal, taxAmount, total }
}
