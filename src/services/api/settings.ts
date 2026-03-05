import { getRows, updateRow, appendRow } from '../google/sheets'
import type { Settings } from '../../types'

export async function getSettings(spreadsheetId: string, token: string): Promise<Settings> {
  const { rows } = await getRows(spreadsheetId, 'Settings', token)
  const settings: Settings = {}
  // Settings tab uses key/value pairs (no id column)
  for (const row of rows) {
    if (row.key) settings[row.key] = row.value || ''
  }
  return settings
}

export async function updateSetting(
  spreadsheetId: string,
  key: string,
  value: string,
  token: string,
): Promise<void> {
  const { rows } = await getRows(spreadsheetId, 'Settings', token)
  const idx = rows.findIndex((r) => r.key === key)
  if (idx >= 0) {
    await updateRow(spreadsheetId, 'Settings', idx + 2, [key, value], token) // +2 for header + 1-indexed
  } else {
    await appendRow(spreadsheetId, 'Settings', [key, value], token)
  }
}

export async function updateSettings(
  spreadsheetId: string,
  updates: Record<string, string>,
  token: string,
): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    await updateSetting(spreadsheetId, key, value, token)
  }
}
