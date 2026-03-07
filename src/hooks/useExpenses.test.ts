import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const authState = {
  spreadsheetId: null as string | null,
  getToken: vi.fn().mockResolvedValue('fake-token'),
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

const mockGetExpenses = vi.fn()
vi.mock('../services/api/expenses', () => ({
  getExpenses: (...args: unknown[]) => mockGetExpenses(...args),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

import { useExpenses } from './useExpenses'

describe('useExpenses loading behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.spreadsheetId = null
    authState.getToken = vi.fn().mockResolvedValue('fake-token')
  })

  it('starts with loading=true', () => {
    const { result } = renderHook(() => useExpenses())
    expect(result.current.loading).toBe(true)
  })

  it('stays loading=true when spreadsheetId is null', async () => {
    authState.spreadsheetId = null

    const { result } = renderHook(() => useExpenses())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // Must stay true — no fetch happened
    expect(result.current.loading).toBe(true)
    expect(result.current.expenses).toEqual([])
  })

  it('sets loading=false only after expenses are fetched', async () => {
    authState.spreadsheetId = 'sheet-123'
    const mockExpenses = [
      { id: '1', jobId: 'j1', amount: 50, description: 'Gas', clientId: '', date: '', category: 'Fuel', receiptFileId: '', receiptFileName: '', billed: false, createdAt: '', updatedAt: '' },
    ]
    mockGetExpenses.mockResolvedValue(mockExpenses)

    const { result } = renderHook(() => useExpenses())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.expenses).toHaveLength(1)
    expect(result.current.expenses[0].amount).toBe(50)
  })

  it('never transitions to loading=false before expense data arrives', async () => {
    let resolveFetch!: (value: unknown[]) => void
    mockGetExpenses.mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve })
    )
    authState.spreadsheetId = 'sheet-123'

    const { result } = renderHook(() => useExpenses())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.expenses).toEqual([])

    await act(async () => {
      resolveFetch([{ id: '1', amount: 100 }])
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.expenses).toHaveLength(1)
  })
})
