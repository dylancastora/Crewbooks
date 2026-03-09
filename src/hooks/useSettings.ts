import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataContext } from '../context/DataProvider'
import { updateSettings as updateSettingsApi } from '../services/api/settings'

export function useSettings() {
  const { spreadsheetId, getToken } = useAuth()
  const { settings, setSettings, settingsLoading: loading, reloadSettings, isRateLimited } = useDataContext()

  const updateSettings = useCallback(async (updates: Record<string, string>) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await updateSettingsApi(spreadsheetId, updates, token)
    setSettings((prev) => ({ ...prev, ...updates }))
  }, [spreadsheetId, getToken, isRateLimited, setSettings])

  return { settings, updateSettings, loading, reload: reloadSettings }
}
