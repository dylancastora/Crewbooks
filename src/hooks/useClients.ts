import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataContext } from '../context/DataProvider'
import {
  createClient as createClientApi,
  updateClient as updateClientApi,
  deleteClient as deleteClientApi,
  createContact as createContactApi,
  updateContact as updateContactApi,
  deleteContact as deleteContactApi,
} from '../services/api/clients'
import type { Client, Contact } from '../types'

export function useClients() {
  const { spreadsheetId, getToken } = useAuth()
  const { clients, setClients, contacts, setContacts, clientsLoading: loading, reloadClients, isRateLimited } = useDataContext()

  const createClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    const client = await createClientApi(spreadsheetId, data, token)
    setClients((prev) => [...prev, client])
    return client
  }, [spreadsheetId, getToken, isRateLimited, setClients])

  const updateClient = useCallback(async (client: Client) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await updateClientApi(spreadsheetId, client, token)
    setClients((prev) => prev.map((c) => c.id === client.id ? client : c))
  }, [spreadsheetId, getToken, isRateLimited, setClients])

  const deleteClient = useCallback(async (clientId: string) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await deleteClientApi(spreadsheetId, clientId, token)
    setClients((prev) => prev.filter((c) => c.id !== clientId))
  }, [spreadsheetId, getToken, isRateLimited, setClients])

  const createContact = useCallback(async (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    const contact = await createContactApi(spreadsheetId, data, token)
    setContacts((prev) => [...prev, contact])
    return contact
  }, [spreadsheetId, getToken, isRateLimited, setContacts])

  const updateContact = useCallback(async (contact: Contact) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await updateContactApi(spreadsheetId, contact, token)
    setContacts((prev) => prev.map((c) => c.id === contact.id ? contact : c))
  }, [spreadsheetId, getToken, isRateLimited, setContacts])

  const deleteContact = useCallback(async (contactId: string) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await deleteContactApi(spreadsheetId, contactId, token)
    setContacts((prev) => prev.filter((c) => c.id !== contactId))
  }, [spreadsheetId, getToken, isRateLimited, setContacts])

  const getContactsForClient = useCallback((clientId: string) => {
    return contacts.filter((c) => c.clientId === clientId)
  }, [contacts])

  return {
    clients, contacts, loading,
    createClient, updateClient, deleteClient,
    createContact, updateContact, deleteContact,
    getContactsForClient,
    reload: reloadClients,
  }
}
