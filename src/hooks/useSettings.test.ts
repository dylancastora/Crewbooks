import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Mutable mock state
const authState = {
  spreadsheetId: null as string | null,
  getToken: vi.fn().mockResolvedValue('fake-token'),
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

const mockGetSettings = vi.fn()
vi.mock('../services/api/settings', () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  updateSettings: vi.fn(),
}))

import { useSettings } from './useSettings'

describe('useSettings loading behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.spreadsheetId = null
    authState.getToken = vi.fn().mockResolvedValue('fake-token')
  })

  it('starts with loading=true', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.loading).toBe(true)
  })

  it('stays loading=true when spreadsheetId is null', async () => {
    // The bug: without our fix, load() called setLoading(true) at the top,
    // then returned early if !spreadsheetId. On a later render when
    // spreadsheetId appeared, it would re-set loading=true then false,
    // but between those calls loading could briefly be false with empty settings.
    //
    // With the fix: loading starts true and load() never touches it
    // until an actual fetch completes.
    authState.spreadsheetId = null

    const { result } = renderHook(() => useSettings())

    expect(result.current.loading).toBe(true)
    expect(result.current.settings).toEqual({})

    // Give time for any async effects to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // Should STILL be loading since we never had a spreadsheetId to fetch with
    expect(result.current.loading).toBe(true)
  })

  it('sets loading=false only after settings are fetched', async () => {
    authState.spreadsheetId = 'sheet-123'
    mockGetSettings.mockResolvedValue({ businessName: 'Test Co' })

    const { result } = renderHook(() => useSettings())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.settings.businessName).toBe('Test Co')
  })

  it('never transitions to loading=false before settings data arrives', async () => {
    // Simulate a slow fetch
    let resolveFetch!: (value: Record<string, string>) => void
    mockGetSettings.mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve })
    )
    authState.spreadsheetId = 'sheet-123'

    const { result } = renderHook(() => useSettings())

    // Still loading while fetch is in-flight
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.settings).toEqual({})

    // Now resolve the fetch
    await act(async () => {
      resolveFetch({ businessName: 'My Biz' })
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.settings.businessName).toBe('My Biz')
  })
})
