import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getExpenses, createExpense as createExpenseApi, updateExpense as updateExpenseApi, deleteExpense as deleteExpenseApi } from '../services/api/expenses'
import type { Expense } from '../types'

export function useExpenses() {
  const { spreadsheetId, getToken } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!spreadsheetId) return
    try {
      const token = await getToken()
      const data = await getExpenses(spreadsheetId, token)
      setExpenses(data)
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId, getToken])

  useEffect(() => { load() }, [load])

  const createExpense = useCallback(async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!spreadsheetId) return
    const token = await getToken()
    const expense = await createExpenseApi(spreadsheetId, data, token)
    setExpenses((prev) => [...prev, expense])
    return expense
  }, [spreadsheetId, getToken])

  const updateExpense = useCallback(async (expense: Expense) => {
    if (!spreadsheetId) return
    const token = await getToken()
    await updateExpenseApi(spreadsheetId, expense, token)
    setExpenses((prev) => prev.map((e) => e.id === expense.id ? expense : e))
  }, [spreadsheetId, getToken])

  const deleteExpense = useCallback(async (expenseId: string) => {
    if (!spreadsheetId) return
    const token = await getToken()
    await deleteExpenseApi(spreadsheetId, expenseId, token)
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
  }, [spreadsheetId, getToken])

  return { expenses, loading, createExpense, updateExpense, deleteExpense, reload: load }
}
