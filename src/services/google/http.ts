const DEFAULT_TIMEOUT_MS = 20_000

/** Receipt uploads and downloads move real bytes over mobile connections. */
export const TRANSFER_TIMEOUT_MS = 60_000

let connectionLostCallback: (() => void) | null = null

export function setConnectionLostCallback(cb: (() => void) | null) {
  connectionLostCallback = cb
}

/**
 * `fetch` with a deadline.
 *
 * A request that hangs never resolves into a Response, so nothing downstream
 * can react to it: the spinner spins forever, and because writes to a tab are
 * serialized, every later write to that tab waits behind it. Failing fast turns
 * an invisible stall into a visible "connection lost" the user can act on.
 *
 * Only transport failures land here — a request that reaches Google and comes
 * back 4xx/5xx resolves normally and is handled by the caller.
 */
export async function apiFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    connectionLostCallback?.()
    throw new Error('Connection lost', { cause: error })
  }
}
