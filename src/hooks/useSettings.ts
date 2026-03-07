import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSettings, updateSettings as updateSettingsApi } from '../services/api/settings'
import type { Settings } from '../types'

export function useSettings() {
  const { spreadsheetId, getToken } = useAuth()
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!spreadsheetId) return
    try {
      const token = await getToken()
      const s = await getSettings(spreadsheetId, token)
      setSettings(s)
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId, getToken])

  useEffect(() => { load() }, [load])

  const updateSettings = useCallback(async (updates: Record<string, string>) => {
    if (!spreadsheetId) return
    const token = await getToken()
    await updateSettingsApi(spreadsheetId, updates, token)
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [spreadsheetId, getToken])

  return { settings, updateSettings, loading, reload: load }
}
