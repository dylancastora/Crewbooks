import { ensureFolder, findFile, createSpreadsheet } from '../google/drive'
import type { Workspace } from '../../types'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const TABS = {
  Clients: ['id', 'company', 'address', 'city', 'state', 'zip', 'notes', 'createdAt', 'updatedAt'],
  Contacts: ['id', 'clientId', 'name', 'email', 'phone', 'role', 'createdAt', 'updatedAt'],
  Labor: ['id', 'name', 'rate', 'unit', 'taxable', 'isActive', 'createdAt', 'updatedAt'],
  Equipment: ['id', 'name', 'rate', 'unit', 'taxable', 'isActive', 'createdAt', 'updatedAt'],
  Jobs: ['id', 'jobNumber', 'clientId', 'title', 'status', 'contactIds', 'shootDates', 'taxRate', 'paymentTerms', 'notes', 'cancelled', 'createdAt', 'updatedAt'],
  JobItems: ['id', 'jobId', 'jobNumber', 'type', 'description', 'date', 'quantity', 'rate', 'taxable', 'sortOrder', 'amount'],
  Expenses: ['id', 'jobId', 'clientId', 'description', 'amount', 'date', 'category', 'receiptFileId', 'receiptFileName', 'billed', 'createdAt', 'updatedAt'],
  Communications: ['id', 'jobId', 'type', 'dateSent', 'recipients', 'amount', 'subject', 'notes', 'isResend', 'priorCommunicationId'],
  Settings: ['key', 'value'],
}

const DEFAULT_SETTINGS = [
  ['mileageRate', '0.725'],
  ['defaultPaymentTerms', 'Net 30'],
  ['defaultTaxRate', '10'],
  ['businessName', ''],
  ['businessAddress', ''],
  ['businessPhone', ''],
  ['businessEmail', ''],
]

// System columns (id columns) to protect with warningOnly
const PROTECTED_COLUMNS: Record<string, number[]> = {
  Clients: [0],
  Contacts: [0],
  Labor: [0],
  Equipment: [0],
  Jobs: [0],
  JobItems: [0],
  Expenses: [0],
  Communications: [0],
}

async function setupSpreadsheet(spreadsheetId: string, token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Get existing sheets to find Sheet1's sheetId for deletion
  const metaRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, { headers })
  const meta = await metaRes.json()
  const defaultSheetId = meta.sheets?.[0]?.properties?.sheetId ?? 0

  // Build batch requests: add all tabs, then delete Sheet1
  const requests: unknown[] = []

  const tabNames = Object.keys(TABS) as (keyof typeof TABS)[]

  // Add tabs
  tabNames.forEach((tab, idx) => {
    requests.push({
      addSheet: {
        properties: { title: tab, index: idx },
      },
    })
  })

  // Delete default Sheet1
  requests.push({ deleteSheet: { sheetId: defaultSheetId } })

  await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requests }),
  })

  // Get new sheet IDs for header writes and protected ranges
  const newMetaRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, { headers })
  const newMeta = await newMetaRes.json()
  const sheetMap: Record<string, number> = {}
  for (const sheet of newMeta.sheets) {
    sheetMap[sheet.properties.title] = sheet.properties.sheetId
  }

  // Write headers for each tab
  const headerData = tabNames.map((tab) => ({
    range: `${tab}!A1`,
    values: [TABS[tab]],
  }))

  await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: headerData,
      }),
    },
  )

  // Write default settings rows
  await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent('Settings!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ values: DEFAULT_SETTINGS }),
    },
  )

  // Add protected ranges (warningOnly) for system columns
  const protectRequests = Object.entries(PROTECTED_COLUMNS).map(([tab, cols]) => {
    return cols.map((col) => ({
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId: sheetMap[tab],
            startRowIndex: 1, // skip header
            startColumnIndex: col,
            endColumnIndex: col + 1,
          },
          description: `System column: ${TABS[tab as keyof typeof TABS][col]}`,
          warningOnly: true,
        },
      },
    }))
  }).flat()

  if (protectRequests.length > 0) {
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests: protectRequests }),
    })
  }
}

async function deleteDefaultSheet(spreadsheetId: string, token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`, { headers })
    const data = await res.json()
    const sheet1 = data.sheets?.find((s: { properties: { title: string } }) => s.properties.title === 'Sheet1')
    if (sheet1) {
      await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: [{ deleteSheet: { sheetId: sheet1.properties.sheetId } }],
        }),
      })
    }
  } catch {
    // Ignore — Sheet1 may not exist
  }
}

export async function initializeUserWorkspace(token: string): Promise<Workspace> {
  // 1. Ensure CrewBooks folder
  const rootFolderId = await ensureFolder('CrewBooks', null, token)

  // 2. Ensure Receipts subfolder
  const receiptsFolderId = await ensureFolder('Receipts', rootFolderId, token)

  // 3. Find or create spreadsheet
  let spreadsheetId = await findFile(
    'CrewBooks Database',
    rootFolderId,
    'application/vnd.google-apps.spreadsheet',
    token,
  )

  if (!spreadsheetId) {
    spreadsheetId = await createSpreadsheet('CrewBooks Database', rootFolderId, token)
    await setupSpreadsheet(spreadsheetId, token)
  } else {
    // Clean up: delete Sheet1 if it still exists from an older init
    await deleteDefaultSheet(spreadsheetId, token)
  }

  return { spreadsheetId, rootFolderId, receiptsFolderId }
}
