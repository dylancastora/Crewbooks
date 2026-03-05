import { getRows, appendRow, updateRow, deleteRow } from '../google/sheets'
import type { LaborRate, EquipmentRate } from '../../types'

type RateType = 'Labor' | 'Equipment'
type Rate = LaborRate | EquipmentRate

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

const RATE_HEADERS = ['id', 'name', 'rate', 'unit', 'taxable', 'isActive', 'createdAt', 'updatedAt']

function rowToRate(row: Record<string, string>): Rate {
  return {
    ...row,
    rate: parseFloat(row.rate) || 0,
    taxable: row.taxable === 'true',
    isActive: row.isActive !== 'false', // default true
  } as unknown as Rate
}

export async function getRates(
  spreadsheetId: string,
  type: RateType,
  token: string,
): Promise<Rate[]> {
  const { rows } = await getRows(spreadsheetId, type, token)
  return rows.map(rowToRate)
}

export async function createRate(
  spreadsheetId: string,
  type: RateType,
  data: Omit<Rate, 'id' | 'createdAt' | 'updatedAt'>,
  token: string,
): Promise<Rate> {
  const rate: Rate = {
    ...data,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  } as Rate
  const row = RATE_HEADERS.map((h) => String((rate as unknown as Record<string, unknown>)[h] ?? ''))
  await appendRow(spreadsheetId, type, row, token)
  return rate
}

export async function updateRate(
  spreadsheetId: string,
  type: RateType,
  rate: Rate,
  token: string,
): Promise<void> {
  const { rows } = await getRows(spreadsheetId, type, token)
  const idx = rows.findIndex((r) => r.id === rate.id)
  if (idx < 0) throw new Error('Rate not found')
  rate.updatedAt = now()
  const row = RATE_HEADERS.map((h) => String((rate as unknown as Record<string, unknown>)[h] ?? ''))
  await updateRow(spreadsheetId, type, idx + 2, row, token)
}

export async function deleteRate(
  spreadsheetId: string,
  type: RateType,
  rateId: string,
  token: string,
): Promise<void> {
  const { rows } = await getRows(spreadsheetId, type, token)
  const idx = rows.findIndex((r) => r.id === rateId)
  if (idx < 0) throw new Error('Rate not found')
  await deleteRow(spreadsheetId, type, idx + 1, token)
}
