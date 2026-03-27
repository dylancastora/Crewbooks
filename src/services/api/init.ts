import { ensureFolder, findFile, createSpreadsheet } from '../google/drive'
import type { Workspace } from '../../types'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const TABS = {
  Clients: ['id', 'company', 'address', 'city', 'state', 'zip', 'notes', 'createdAt', 'updatedAt'],
  Contacts: ['id', 'clientId', 'name', 'email', 'phone', 'role', 'createdAt', 'updatedAt'],
  Labor: ['id', 'name', 'rate', 'unit', 'taxable', 'isActive', 'createdAt', 'updatedAt'],
  Equipment: ['id', 'name', 'rate', 'unit', 'taxable', 'isActive', 'createdAt', 'updatedAt'],
  Jobs: ['id', 'jobNumber', 'clientId', 'title', 'status', 'contactIds', 'shootDates', 'taxRate', 'paymentTerms', 'paymentWindow', 'dueDate', 'notes', 'cancelled', 'createdAt', 'updatedAt'],
  JobItems: ['id', 'jobId', 'jobNumber', 'type', 'description', 'days', 'quantity', 'rate', 'taxable', 'sortOrder', 'amount'],
  Expenses: ['id', 'jobId', 'clientId', 'description', 'amount', 'date', 'category', 'receiptFileId', 'receiptFileName', 'billed', 'createdAt', 'updatedAt'],
  Communications: ['id', 'jobId', 'type', 'dateSent', 'recipients', 'amount', 'subject', 'notes', 'isResend', 'priorCommunicationId'],
  Settings: ['key', 'value'],
}

export const DEFAULT_SETTINGS = [
  ['mileageRate', '0.725'],
  ['defaultPaymentTerms', 'Net 30'],
  ['defaultPaymentWindow', '30'],
  ['defaultTaxRate', '10'],
  ['businessName', ''],
  ['businessAddress', ''],
  ['businessPhone', ''],
  ['businessEmail', ''],
]

// Locked columns by index — protected with warningOnly + grey text
const LOCKED_COLUMNS: Record<string, number[]> = {
  Clients: [0, 7, 8],                                      // id, createdAt, updatedAt
  Contacts: [0, 1, 6, 7],                                  // id, clientId, createdAt, updatedAt
  Labor: [0, 6, 7],                                        // id, createdAt, updatedAt
  Equipment: [0, 3, 6, 7],                                 // id, unit, createdAt, updatedAt
  Jobs: [0, 1, 2, 3, 4, 5, 6, 12, 13, 14],                // id, jobNumber, clientId, title, status, contactIds, shootDates, cancelled, createdAt, updatedAt
  JobItems: [0, 1, 2, 3, 9, 10],                           // id, jobId, jobNumber, type, sortOrder, amount
  Expenses: [0, 1, 2, 7, 8, 10, 11],                       // id, jobId, clientId, receiptFileId, receiptFileName, createdAt, updatedAt
  Communications: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],         // ALL columns
  Settings: [0],                                             // key
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

  // Format headers + locked columns, and add protections
  const formatRequests: unknown[] = []

  for (const tab of tabNames) {
    const sheetId = sheetMap[tab]

    // Bold white text on dark blue background for header row
    formatRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.12, green: 0.24, blue: 0.43 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    })

    // Protect header row
    formatRequests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          description: `Header row: ${tab}`,
          warningOnly: true,
        },
      },
    })

    // Grey text + protection for locked columns
    const lockedCols = LOCKED_COLUMNS[tab]
    if (lockedCols) {
      for (const col of lockedCols) {
        formatRequests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 } },
              },
            },
            fields: 'userEnteredFormat(textFormat.foregroundColor)',
          },
        })
        formatRequests.push({
          addProtectedRange: {
            protectedRange: {
              range: { sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
              description: `Locked column: ${tab}.${TABS[tab][col]}`,
              warningOnly: true,
            },
          },
        })
      }
    }
  }

  if (formatRequests.length > 0) {
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests: formatRequests }),
    })
  }

  // Write format version so conform skips formatting on first login
  await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent('Settings!A2')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ values: [['_sheetFormatVersion', '1']] }),
    },
  )
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
