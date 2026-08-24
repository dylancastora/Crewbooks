import { getRows, appendRow, updateRowById, deleteRowById, deleteRowsMatching } from '../google/sheets'
import { unlinkExpensesFromJob } from './expenses'
import { JobStatus } from '../../types'
import type { Job, JobItem, Expense, JobTotals, Settings } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

const JOB_HEADERS = ['id', 'jobNumber', 'clientId', 'title', 'status', 'contactIds', 'shootDates', 'taxRate', 'paymentTerms', 'paymentWindow', 'dueDate', 'notes', 'cancelled', 'createdAt', 'updatedAt']

function rowToJob(row: Record<string, string>): Job {
  return {
    ...row,
    taxRate: parseFloat(row.taxRate) || 0,
    paymentWindow: parseInt(row.paymentWindow) || 30,
    cancelled: row.cancelled === 'true',
  } as unknown as Job
}

export function generateJobNumber(existingJobs: Job[], settings: Settings): string {
  const startNumber = parseInt(settings.invoiceStartNumber || '1') || 1
  if (existingJobs.length === 0) return String(startNumber).padStart(4, '0')
  const maxNumber = Math.max(
    ...existingJobs.map((j) => parseInt(j.jobNumber) || 0),
    startNumber - 1,
  )
  return String(maxNumber + 1).padStart(4, '0')
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
    paymentWindow: data.paymentWindow ?? (parseInt(settings.defaultPaymentWindow || '30') || 30),
    dueDate: '',
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
  // Line items and communications only exist to describe this job.
  for (const tab of ['JobItems', 'Communications']) {
    await deleteRowsMatching(spreadsheetId, tab, 'jobId', jobId, token)
  }
  // Expenses are the client's, not the job's — they outlive it.
  await unlinkExpensesFromJob(spreadsheetId, jobId, token)
  await deleteRowById(spreadsheetId, 'Jobs', jobId, token)
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
