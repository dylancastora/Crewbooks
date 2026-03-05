import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getCommunications, createCommunication as createCommApi } from '../services/api/communications'
import type { Communication } from '../types'

export function useCommunications() {
  const { spreadsheetId, getToken } = useAuth()
  const [communications, setCommunications] = useState<Communication[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!spreadsheetId) return
    setLoading(true)
    try {
      const token = await getToken()
      const data = await getCommunications(spreadsheetId, token)
      setCommunications(data)
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId, getToken])

  useEffect(() => { load() }, [load])

  const getForJob = useCallback((jobId: string) => {
    return communications.filter((c) => c.jobId === jobId)
  }, [communications])

  const createCommunication = useCallback(async (data: Omit<Communication, 'id'>) => {
    if (!spreadsheetId) return
    const token = await getToken()
    const comm = await createCommApi(spreadsheetId, data, token)
    setCommunications((prev) => [...prev, comm])
    return comm
  }, [spreadsheetId, getToken])

  return { communications, getForJob, createCommunication, loading, reload: load }
}
