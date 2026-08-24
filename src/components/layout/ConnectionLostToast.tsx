import { useDataContext } from '../../context/DataProvider'

/**
 * Shown when a request to Google times out or never reaches the network.
 * Reloading re-runs the OAuth flow, which also clears an expired token — the
 * usual cause after the app has been sitting in the background.
 */
export function ConnectionLostToast() {
  const { connectionLost, dismissConnectionLost } = useDataContext()

  if (!connectionLost) return null

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 text-white pl-4 pr-2 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in max-w-[90vw]"
    >
      <span>Connection lost</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-white/15 hover:bg-white/25 px-3 py-1.5 min-h-[36px] font-semibold transition-colors"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={dismissConnectionLost}
        aria-label="Dismiss"
        className="text-gray-400 hover:text-white min-w-[32px] min-h-[36px] text-lg leading-none"
      >
        &times;
      </button>
    </div>
  )
}
