import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch, setConnectionLostCallback } from './http'

function okResponse(): Response {
  return { ok: true, status: 200, statusText: 'OK', headers: new Headers(), json: async () => ({}) } as Response
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setConnectionLostCallback(null)
  })

  it('passes a successful response straight through', async () => {
    const response = okResponse()
    vi.stubGlobal('fetch', vi.fn(async () => response))
    const onLost = vi.fn()
    setConnectionLostCallback(onLost)

    expect(await apiFetch('https://example.com')).toBe(response)
    expect(onLost).not.toHaveBeenCalled()
  })

  it('gives every request an abort signal', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('https://example.com')

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  // An HTTP error still reached Google — callers handle those, not this layer.
  it('does not report a connection loss for a 500', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ...okResponse(), ok: false, status: 500 })))
    const onLost = vi.fn()
    setConnectionLostCallback(onLost)

    await apiFetch('https://example.com')

    expect(onLost).not.toHaveBeenCalled()
  })

  it('reports a connection loss when the request never completes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => (
      // Resolve only if the caller's deadline never fires — it always does.
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    )))
    const onLost = vi.fn()
    setConnectionLostCallback(onLost)

    await expect(apiFetch('https://example.com', {}, 10)).rejects.toThrow('Connection lost')
    expect(onLost).toHaveBeenCalledOnce()
  })

  it('reports a connection loss when the network is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const onLost = vi.fn()
    setConnectionLostCallback(onLost)

    await expect(apiFetch('https://example.com')).rejects.toThrow('Connection lost')
    expect(onLost).toHaveBeenCalledOnce()
  })

  it('keeps the underlying failure as the error cause', async () => {
    const underlying = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => { throw underlying }))

    await expect(apiFetch('https://example.com')).rejects.toMatchObject({ cause: underlying })
  })
})
