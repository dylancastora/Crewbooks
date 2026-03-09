import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataContext } from '../context/DataProvider'
import { createCommunication as createCommApi } from '../services/api/communications'
import type { Communication } from '../types'

export function useCommunications() {
  const { spreadsheetId, getToken } = useAuth()
  const { communications, setCommunications, communicationsLoading: loading, reloadCommunications, isRateLimited } = useDataContext()

  const getForJob = useCallback((jobId: string) => {
    return communications.filter((c) => c.jobId === jobId)
  }, [communications])

  const createCommunication = useCallback(async (data: Omit<Communication, 'id'>) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    const comm = await createCommApi(spreadsheetId, data, token)
    setCommunications((prev) => [...prev, comm])
    return comm
  }, [spreadsheetId, getToken, isRateLimited, setCommunications])

  return { communications, getForJob, createCommunication, loading, reload: reloadCommunications }
}
