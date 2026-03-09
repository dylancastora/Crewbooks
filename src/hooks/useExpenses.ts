import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataContext } from '../context/DataProvider'
import { createExpense as createExpenseApi, updateExpense as updateExpenseApi, deleteExpense as deleteExpenseApi } from '../services/api/expenses'
import type { Expense } from '../types'

export function useExpenses() {
  const { spreadsheetId, getToken } = useAuth()
  const { expenses, setExpenses, expensesLoading: loading, reloadExpenses, isRateLimited } = useDataContext()

  const createExpense = useCallback(async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    const expense = await createExpenseApi(spreadsheetId, data, token)
    setExpenses((prev) => [...prev, expense])
    return expense
  }, [spreadsheetId, getToken, isRateLimited, setExpenses])

  const updateExpense = useCallback(async (expense: Expense) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await updateExpenseApi(spreadsheetId, expense, token)
    setExpenses((prev) => prev.map((e) => e.id === expense.id ? expense : e))
  }, [spreadsheetId, getToken, isRateLimited, setExpenses])

  const deleteExpense = useCallback(async (expenseId: string) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await deleteExpenseApi(spreadsheetId, expenseId, token)
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
  }, [spreadsheetId, getToken, isRateLimited, setExpenses])

  return { expenses, loading, createExpense, updateExpense, deleteExpense, reload: reloadExpenses }
}
