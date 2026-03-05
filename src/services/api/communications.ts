import { getRows, appendRow } from '../google/sheets'
import type { Communication } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

const COMM_HEADERS = ['id', 'jobId', 'type', 'dateSent', 'recipients', 'amount', 'subject', 'notes', 'isResend', 'priorCommunicationId']

function rowToCommunication(row: Record<string, string>): Communication {
  return {
    ...row,
    amount: parseFloat(row.amount) || 0,
    isResend: row.isResend === 'true',
  } as unknown as Communication
}

export async function getCommunications(spreadsheetId: string, token: string): Promise<Communication[]> {
  const { rows } = await getRows(spreadsheetId, 'Communications', token)
  return rows.map(rowToCommunication)
}

export async function getCommunicationsForJob(spreadsheetId: string, jobId: string, token: string): Promise<Communication[]> {
  const all = await getCommunications(spreadsheetId, token)
  return all.filter((c) => c.jobId === jobId)
}

export async function createCommunication(
  spreadsheetId: string,
  data: Omit<Communication, 'id'>,
  token: string,
): Promise<Communication> {
  const comm: Communication = {
    ...data,
    id: generateId(),
  }
  const obj = comm as unknown as Record<string, unknown>
  const row = COMM_HEADERS.map((h) => String(obj[h] ?? ''))
  await appendRow(spreadsheetId, 'Communications', row, token)
  return comm
}
