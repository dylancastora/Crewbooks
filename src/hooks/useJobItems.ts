import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllJobItems } from '../services/api/jobItems'
import type { JobItem } from '../types'

export function useJobItems() {
  const { spreadsheetId, getToken } = useAuth()
  const [allItems, setAllItems] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!spreadsheetId) return
    setLoading(true)
    try {
      const token = await getToken()
      const data = await getAllJobItems(spreadsheetId, token)
      setAllItems(data)
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId, getToken])

  useEffect(() => { load() }, [load])

  const getItemsForJob = useCallback((jobId: string) => {
    return allItems.filter((item) => item.jobId === jobId)
  }, [allItems])

  return { allItems, getItemsForJob, loading, reload: load }
}
