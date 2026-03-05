import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getRates, createRate as createRateApi, updateRate as updateRateApi, deleteRate as deleteRateApi } from '../services/api/rates'
import type { LaborRate, EquipmentRate } from '../types'

export function useRates() {
  const { spreadsheetId, getToken } = useAuth()
  const [labor, setLabor] = useState<LaborRate[]>([])
  const [equipment, setEquipment] = useState<EquipmentRate[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!spreadsheetId) return
    setLoading(true)
    try {
      const token = await getToken()
      const [l, e] = await Promise.all([
        getRates(spreadsheetId, 'Labor', token),
        getRates(spreadsheetId, 'Equipment', token),
      ])
      setLabor(l as LaborRate[])
      setEquipment(e as EquipmentRate[])
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId, getToken])

  useEffect(() => { load() }, [load])

  const createRate = useCallback(async (type: 'Labor' | 'Equipment', data: Omit<LaborRate | EquipmentRate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!spreadsheetId) return
    const token = await getToken()
    const rate = await createRateApi(spreadsheetId, type, data, token)
    if (type === 'Labor') setLabor((prev) => [...prev, rate as LaborRate])
    else setEquipment((prev) => [...prev, rate as EquipmentRate])
    return rate
  }, [spreadsheetId, getToken])

  const updateRate = useCallback(async (type: 'Labor' | 'Equipment', rate: LaborRate | EquipmentRate) => {
    if (!spreadsheetId) return
    const token = await getToken()
    await updateRateApi(spreadsheetId, type, rate, token)
    if (type === 'Labor') setLabor((prev) => prev.map((r) => r.id === rate.id ? rate as LaborRate : r))
    else setEquipment((prev) => prev.map((r) => r.id === rate.id ? rate as EquipmentRate : r))
  }, [spreadsheetId, getToken])

  const deleteRate = useCallback(async (type: 'Labor' | 'Equipment', rateId: string) => {
    if (!spreadsheetId) return
    const token = await getToken()
    await deleteRateApi(spreadsheetId, type, rateId, token)
    if (type === 'Labor') setLabor((prev) => prev.filter((r) => r.id !== rateId))
    else setEquipment((prev) => prev.filter((r) => r.id !== rateId))
  }, [spreadsheetId, getToken])

  return { labor, equipment, loading, createRate, updateRate, deleteRate, reload: load }
}
