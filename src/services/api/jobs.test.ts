import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateJobNumber, deleteJob } from './jobs'
import type { Job, Settings } from '../../types'

function makeJob(jobNumber: string): Job {
  return {
    id: crypto.randomUUID(),
    jobNumber,
    clientId: '',
    title: '',
    status: 'draft',
    contactIds: '',
    shootDates: '',
    taxRate: 0,
    paymentTerms: '',
    notes: '',
    cancelled: false,
    createdAt: '',
    updatedAt: '',
  }
}

describe('generateJobNumber', () => {
  it('returns "0001" when no existing jobs and no custom start number', () => {
    const result = generateJobNumber([], {})
    expect(result).toBe('0001')
  })

  it('respects invoiceStartNumber setting when no existing jobs', () => {
    const settings: Settings = { invoiceStartNumber: '100' }
    const result = generateJobNumber([], settings)
    expect(result).toBe('0100')
  })

  it('returns max job number + 1 from existing jobs', () => {
    const jobs = [makeJob('0003'), makeJob('0007'), makeJob('0005')]
    const result = generateJobNumber(jobs, {})
    expect(result).toBe('0008')
  })

  it('uses invoiceStartNumber as floor when existing jobs are below it', () => {
    const jobs = [makeJob('0002')]
    const settings: Settings = { invoiceStartNumber: '100' }
    const result = generateJobNumber(jobs, settings)
    expect(result).toBe('0100')
  })

  it('ignores invoiceStartNumber when existing jobs exceed it', () => {
    const jobs = [makeJob('0150')]
    const settings: Settings = { invoiceStartNumber: '100' }
    const result = generateJobNumber(jobs, settings)
    expect(result).toBe('0151')
  })

  it('handles non-numeric job numbers gracefully', () => {
    const jobs = [makeJob('abc'), makeJob('0010')]
    const result = generateJobNumber(jobs, {})
    expect(result).toBe('0011')
  })

  it('pads result to 4 digits', () => {
    const jobs = [makeJob('0001')]
    const result = generateJobNumber(jobs, {})
    expect(result).toBe('0002')
  })

  // KEY TEST: This is the bug scenario — calling with empty jobs array
  // should return start number, NOT always 0001
  it('returns correct number with empty jobs array but custom start number', () => {
    const settings: Settings = { invoiceStartNumber: '500' }
    const result = generateJobNumber([], settings)
    expect(result).toBe('0500')
  })
})

const SHEET = 'sheet-1'
const TOKEN = 'token'
const JOB_ID = 'job-1'

const EXPENSE_COLUMNS = ['id', 'jobId', 'clientId', 'description', 'amount', 'date', 'category', 'receiptFileId', 'receiptFileName', 'billed', 'createdAt', 'updatedAt']

const TABS: Record<string, string[][]> = {
  Jobs: [
    ['id', 'jobNumber'],
    [JOB_ID, '0042'],
    ['job-2', '0043'],
  ],
  JobItems: [
    ['id', 'jobId', 'description'],
    ['item-1', JOB_ID, 'Camera op'],
  ],
  Communications: [
    ['id', 'jobId', 'type'],
    ['comm-1', JOB_ID, 'invoice'],
  ],
  // Full canonical column set — rows are written positionally against it.
  Expenses: [
    EXPENSE_COLUMNS,
    ['exp-1', JOB_ID, 'client-1', 'Parking', '25', '2026-04-01', 'Parking', '', '', 'true', '', ''],
    ['exp-2', '', 'client-1', 'Fuel', '40', '2026-04-01', 'Fuel', '', '', 'false', '', ''],
  ],
}

function expenseField(row: string[], column: string): string {
  return row[EXPENSE_COLUMNS.indexOf(column)]
}

const SHEET_IDS: Record<string, number> = { Jobs: 0, JobItems: 1, Communications: 2, Expenses: 3 }

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, statusText: 'OK', headers: new Headers(), json: async () => body } as Response
}

/** Records which tabs got row deletions and what values were written. */
function mockWorkspace() {
  const deletedFrom: string[] = []
  const valueWrites: { range: string; values: string[][] }[] = []
  const tabBySheetId = Object.fromEntries(Object.entries(SHEET_IDS).map(([tab, id]) => [id, tab]))

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('?fields=sheets.properties')) {
      return jsonResponse({
        sheets: Object.entries(SHEET_IDS).map(([title, sheetId]) => ({ properties: { title, sheetId } })),
      })
    }
    if (url.includes('/values:batchUpdate')) {
      valueWrites.push(...JSON.parse(String(init?.body)).data)
      return jsonResponse({})
    }
    if (url.includes(':batchUpdate')) {
      for (const request of JSON.parse(String(init?.body)).requests) {
        deletedFrom.push(tabBySheetId[request.deleteDimension.range.sheetId])
      }
      return jsonResponse({})
    }
    const tab = decodeURIComponent(url).match(/\/values\/([^?]+)/)?.[1]
    return jsonResponse({ values: TABS[tab!] })
  })

  return { deletedFrom, valueWrites, fetchMock }
}

describe('deleteJob', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('removes the job, its line items and its communications', async () => {
    const { deletedFrom, fetchMock } = mockWorkspace()
    vi.stubGlobal('fetch', fetchMock)

    await deleteJob(SHEET, JOB_ID, TOKEN)

    expect(deletedFrom).toContain('Jobs')
    expect(deletedFrom).toContain('JobItems')
    expect(deletedFrom).toContain('Communications')
  })

  // The spend still happened — the expense record has to outlive the job.
  it('never deletes expense rows', async () => {
    const { deletedFrom, fetchMock } = mockWorkspace()
    vi.stubGlobal('fetch', fetchMock)

    await deleteJob(SHEET, JOB_ID, TOKEN)

    expect(deletedFrom).not.toContain('Expenses')
  })

  it('detaches the job\'s expenses and returns them to unbilled, still on the client', async () => {
    const { valueWrites, fetchMock } = mockWorkspace()
    vi.stubGlobal('fetch', fetchMock)

    await deleteJob(SHEET, JOB_ID, TOKEN)

    expect(valueWrites).toHaveLength(1)
    const written = valueWrites[0].values[0]
    expect(expenseField(written, 'id')).toBe('exp-1')
    expect(expenseField(written, 'jobId')).toBe('')
    expect(expenseField(written, 'billed')).toBe('false')
    // Still the client's expense, with its description and amount intact.
    expect(expenseField(written, 'clientId')).toBe('client-1')
    expect(expenseField(written, 'description')).toBe('Parking')
    expect(expenseField(written, 'amount')).toBe('25')
  })

  it('leaves expenses belonging to other jobs alone', async () => {
    const { valueWrites, fetchMock } = mockWorkspace()
    vi.stubGlobal('fetch', fetchMock)

    await deleteJob(SHEET, JOB_ID, TOKEN)

    expect(valueWrites.flatMap((w) => w.values.map((v) => v[0]))).not.toContain('exp-2')
  })
})
