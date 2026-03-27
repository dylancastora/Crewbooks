import { appendRow, updateRowById, deleteRowById, batchGet } from '../google/sheets'
import type { Client, Contact } from '../../types'

function generateId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

const CLIENT_HEADERS = ['id', 'company', 'address', 'city', 'state', 'zip', 'notes', 'createdAt', 'updatedAt']
const CONTACT_HEADERS = ['id', 'clientId', 'name', 'email', 'phone', 'role', 'createdAt', 'updatedAt']

function rowToClient(row: Record<string, string>): Client {
  return { ...row } as unknown as Client
}

function rowToContact(row: Record<string, string>): Contact {
  return { ...row } as unknown as Contact
}

export async function getClientsAndContacts(
  spreadsheetId: string,
  token: string,
): Promise<{ clients: Client[]; contacts: Contact[] }> {
  const [clientValues, contactValues] = await batchGet(spreadsheetId, ['Clients', 'Contacts'], token)

  const clientHeaders = clientValues[0] || CLIENT_HEADERS
  const clients = clientValues.slice(1)
    .map((row) => {
      const obj: Record<string, string> = {}
      clientHeaders.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    })
    .filter((r) => r.id)
    .map(rowToClient)

  const contactHeaders = contactValues[0] || CONTACT_HEADERS
  const contacts = contactValues.slice(1)
    .map((row) => {
      const obj: Record<string, string> = {}
      contactHeaders.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    })
    .filter((r) => r.id)
    .map(rowToContact)

  return { clients, contacts }
}

export async function createClient(
  spreadsheetId: string,
  data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>,
  token: string,
): Promise<Client> {
  const client: Client = {
    ...data,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  }
  const obj = client as unknown as Record<string, unknown>
  const row = CLIENT_HEADERS.map((h) => String(obj[h] ?? ''))
  await appendRow(spreadsheetId, 'Clients', row, token)
  return client
}

export async function updateClient(
  spreadsheetId: string,
  client: Client,
  token: string,
): Promise<void> {
  client.updatedAt = now()
  const obj = client as unknown as Record<string, unknown>
  const row = CLIENT_HEADERS.map((h) => String(obj[h] ?? ''))
  await updateRowById(spreadsheetId, 'Clients', client.id, row, token)
}

export async function deleteClient(
  spreadsheetId: string,
  clientId: string,
  token: string,
): Promise<void> {
  await deleteRowById(spreadsheetId, 'Clients', clientId, token)
}

export async function createContact(
  spreadsheetId: string,
  data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>,
  token: string,
): Promise<Contact> {
  const contact: Contact = {
    ...data,
    phone: (data.phone || '').replace(/\D/g, ''),
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  }
  const obj = contact as unknown as Record<string, unknown>
  const row = CONTACT_HEADERS.map((h) => String(obj[h] ?? ''))
  await appendRow(spreadsheetId, 'Contacts', row, token)
  return contact
}

export async function updateContact(
  spreadsheetId: string,
  contact: Contact,
  token: string,
): Promise<void> {
  contact.phone = (contact.phone || '').replace(/\D/g, '')
  contact.updatedAt = now()
  const obj = contact as unknown as Record<string, unknown>
  const row = CONTACT_HEADERS.map((h) => String(obj[h] ?? ''))
  await updateRowById(spreadsheetId, 'Contacts', contact.id, row, token)
}

export async function deleteContact(
  spreadsheetId: string,
  contactId: string,
  token: string,
): Promise<void> {
  await deleteRowById(spreadsheetId, 'Contacts', contactId, token)
}

