import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getJobs } from '../services/api/jobs'
import { getClientsAndContacts } from '../services/api/clients'
import { getExpenses } from '../services/api/expenses'
import { getAllJobItems } from '../services/api/jobItems'
import { getCommunications } from '../services/api/communications'
import { getSettings } from '../services/api/settings'
import { getRates } from '../services/api/rates'
import { setRateLimitCallback } from '../services/google/sheets'
import { conformSchema } from '../services/api/conform'
import type { Job, Client, Contact, Expense, JobItem, Communication, Settings, LaborRate, EquipmentRate } from '../types'

interface RateLimitState {
  isRateLimited: boolean
  retryAfterTimestamp: number | null
}

interface DataContextValue {
  // Data
  jobs: Job[]
  clients: Client[]
  contacts: Contact[]
  expenses: Expense[]
  allItems: JobItem[]
  communications: Communication[]
  settings: Settings
  labor: LaborRate[]
  equipment: EquipmentRate[]

  // Loading
  loading: boolean
  jobsLoading: boolean
  clientsLoading: boolean
  expensesLoading: boolean
  itemsLoading: boolean
  communicationsLoading: boolean
  settingsLoading: boolean
  ratesLoading: boolean

  // Setters (for optimistic updates from hooks)
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>
  setClients: React.Dispatch<React.SetStateAction<Client[]>>
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>
  setAllItems: React.Dispatch<React.SetStateAction<JobItem[]>>
  setCommunications: React.Dispatch<React.SetStateAction<Communication[]>>
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  setLabor: React.Dispatch<React.SetStateAction<LaborRate[]>>
  setEquipment: React.Dispatch<React.SetStateAction<EquipmentRate[]>>

  // Reload functions
  reloadJobs: () => Promise<void>
  reloadClients: () => Promise<void>
  reloadExpenses: () => Promise<void>
  reloadItems: () => Promise<void>
  reloadCommunications: () => Promise<void>
  reloadSettings: () => Promise<void>
  reloadRates: () => Promise<void>
  reloadAll: () => Promise<void>

  // Conforming
  conforming: boolean

  // Rate limiting
  isRateLimited: boolean
  retryAfterTimestamp: number | null
  setRateLimited: (retryAfterSeconds: number) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useDataContext must be used within DataProvider')
  return ctx
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { spreadsheetId, getToken } = useAuth()

  // Data state
  const [jobs, setJobs] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [allItems, setAllItems] = useState<JobItem[]>([])
  const [communications, setCommunications] = useState<Communication[]>([])
  const [settings, setSettings] = useState<Settings>({})
  const [labor, setLabor] = useState<LaborRate[]>([])
  const [equipment, setEquipment] = useState<EquipmentRate[]>([])

  // Loading state
  const [jobsLoading, setJobsLoading] = useState(true)
  const [clientsLoading, setClientsLoading] = useState(true)
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(true)
  const [communicationsLoading, setCommunicationsLoading] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [ratesLoading, setRatesLoading] = useState(true)

  const [conforming, setConforming] = useState(false)

  // Rate limit state
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfterTimestamp: null,
  })
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setRateLimited = useCallback((retryAfterSeconds: number) => {
    const timestamp = Date.now() + retryAfterSeconds * 1000
    setRateLimitState({ isRateLimited: true, retryAfterTimestamp: timestamp })
  }, [])

  // Register rate limit callback with sheets.ts
  useEffect(() => {
    setRateLimitCallback(setRateLimited)
    return () => setRateLimitCallback(() => {})
  }, [setRateLimited])

  // Individual reload functions
  const reloadJobs = useCallback(async () => {
    if (!spreadsheetId) return
    setJobsLoading(true)
    try {
      const token = await getToken()
      const data = await getJobs(spreadsheetId, token)
      setJobs(data)
    } finally {
      setJobsLoading(false)
    }
  }, [spreadsheetId, getToken])

  const reloadClients = useCallback(async () => {
    if (!spreadsheetId) return
    setClientsLoading(true)
    try {
      const token = await getToken()
      const data = await getClientsAndContacts(spreadsheetId, token)
      setClients(data.clients)
      setContacts(data.contacts)
    } finally {
      setClientsLoading(false)
    }
  }, [spreadsheetId, getToken])

  const reloadExpenses = useCallback(async () => {
    if (!spreadsheetId) return
    setExpensesLoading(true)
    try {
      const token = await getToken()
      const data = await getExpenses(spreadsheetId, token)
      setExpenses(data)
    } finally {
      setExpensesLoading(false)
    }
  }, [spreadsheetId, getToken])

  const reloadItems = useCallback(async () => {
    if (!spreadsheetId) return
    setItemsLoading(true)
    try {
      const token = await getToken()
      const data = await getAllJobItems(spreadsheetId, token)
      setAllItems(data)
    } finally {
      setItemsLoading(false)
    }
  }, [spreadsheetId, getToken])

  const reloadCommunications = useCallback(async () => {
    if (!spreadsheetId) return
    setCommunicationsLoading(true)
    try {
      const token = await getToken()
      const data = await getCommunications(spreadsheetId, token)
      setCommunications(data)
    } finally {
      setCommunicationsLoading(false)
    }
  }, [spreadsheetId, getToken])

  const reloadSettings = useCallback(async () => {
    if (!spreadsheetId) return
    setSettingsLoading(true)
    try {
      const token = await getToken()
      const data = await getSettings(spreadsheetId, token)
      setSettings(data)
    } finally {
      setSettingsLoading(false)
    }
  }, [spreadsheetId, getToken])

  const reloadRates = useCallback(async () => {
    if (!spreadsheetId) return
    setRatesLoading(true)
    try {
      const token = await getToken()
      const [l, e] = await Promise.all([
        getRates(spreadsheetId, 'Labor', token),
        getRates(spreadsheetId, 'Equipment', token),
      ])
      setLabor(l as LaborRate[])
      setEquipment(e as EquipmentRate[])
    } finally {
      setRatesLoading(false)
    }
  }, [spreadsheetId, getToken])

  const reloadAll = useCallback(async () => {
    await Promise.all([
      reloadJobs(),
      reloadClients(),
      reloadExpenses(),
      reloadItems(),
      reloadCommunications(),
      reloadSettings(),
      reloadRates(),
    ])
  }, [reloadJobs, reloadClients, reloadExpenses, reloadItems, reloadCommunications, reloadSettings, reloadRates])

  // Initial load on mount — conform schema first, then load data
  useEffect(() => {
    if (spreadsheetId) {
      setConforming(true)
      getToken()
        .then((token) => conformSchema(spreadsheetId, token))
        .then(() => { setConforming(false); return reloadAll() })
        .catch(() => setConforming(false))
    }
  }, [spreadsheetId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-retry when rate limit expires
  useEffect(() => {
    if (!rateLimitState.isRateLimited || !rateLimitState.retryAfterTimestamp) return

    const delay = rateLimitState.retryAfterTimestamp - Date.now()
    if (delay <= 0) {
      setRateLimitState({ isRateLimited: false, retryAfterTimestamp: null })
      reloadAll()
      return
    }

    retryTimerRef.current = setTimeout(() => {
      setRateLimitState({ isRateLimited: false, retryAfterTimestamp: null })
      reloadAll()
    }, delay)

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [rateLimitState, reloadAll])

  const loading = jobsLoading || clientsLoading || expensesLoading || itemsLoading || communicationsLoading || settingsLoading || ratesLoading

  return (
    <DataContext.Provider
      value={{
        jobs, clients, contacts, expenses, allItems, communications, settings, labor, equipment,
        loading, conforming, jobsLoading, clientsLoading, expensesLoading, itemsLoading, communicationsLoading, settingsLoading, ratesLoading,
        setJobs, setClients, setContacts, setExpenses, setAllItems, setCommunications, setSettings, setLabor, setEquipment,
        reloadJobs, reloadClients, reloadExpenses, reloadItems, reloadCommunications, reloadSettings, reloadRates, reloadAll,
        isRateLimited: rateLimitState.isRateLimited,
        retryAfterTimestamp: rateLimitState.retryAfterTimestamp,
        setRateLimited,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}
