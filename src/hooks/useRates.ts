import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataContext } from '../context/DataProvider'
import { createRate as createRateApi, updateRate as updateRateApi, deleteRate as deleteRateApi } from '../services/api/rates'
import type { LaborRate, EquipmentRate } from '../types'

export function useRates() {
  const { spreadsheetId, getToken } = useAuth()
  const { labor, setLabor, equipment, setEquipment, ratesLoading: loading, reloadRates, isRateLimited } = useDataContext()

  const createRate = useCallback(async (type: 'Labor' | 'Equipment', data: Omit<LaborRate | EquipmentRate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    const rate = await createRateApi(spreadsheetId, type, data, token)
    if (type === 'Labor') setLabor((prev) => [...prev, rate as LaborRate])
    else setEquipment((prev) => [...prev, rate as EquipmentRate])
    return rate
  }, [spreadsheetId, getToken, isRateLimited, setLabor, setEquipment])

  const updateRate = useCallback(async (type: 'Labor' | 'Equipment', rate: LaborRate | EquipmentRate) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await updateRateApi(spreadsheetId, type, rate, token)
    if (type === 'Labor') setLabor((prev) => prev.map((r) => r.id === rate.id ? rate as LaborRate : r))
    else setEquipment((prev) => prev.map((r) => r.id === rate.id ? rate as EquipmentRate : r))
  }, [spreadsheetId, getToken, isRateLimited, setLabor, setEquipment])

  const deleteRate = useCallback(async (type: 'Labor' | 'Equipment', rateId: string) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await deleteRateApi(spreadsheetId, type, rateId, token)
    if (type === 'Labor') setLabor((prev) => prev.filter((r) => r.id !== rateId))
    else setEquipment((prev) => prev.filter((r) => r.id !== rateId))
  }, [spreadsheetId, getToken, isRateLimited, setLabor, setEquipment])

  return { labor, equipment, loading, createRate, updateRate, deleteRate, reload: reloadRates }
}
