import { useState, useEffect } from 'react'
import { useDataContext } from '../../context/DataProvider'

export function RateLimitModal() {
  const { isRateLimited, retryAfterTimestamp } = useDataContext()
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!isRateLimited || !retryAfterTimestamp) {
      setSecondsLeft(0)
      return
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((retryAfterTimestamp - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isRateLimited, retryAfterTimestamp])

  if (!isRateLimited) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-8 text-center">
        <div className="text-4xl mb-4">&#9203;</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">API Limit Reached</h2>
        <p className="text-gray-600 mb-6">
          Google Sheets API rate limit exceeded. The app will automatically resume when the cooldown expires.
        </p>
        <div className="text-5xl font-mono font-bold text-primary mb-2">
          {secondsLeft}s
        </div>
        <p className="text-sm text-gray-400">Retrying automatically...</p>
      </div>
    </div>
  )
}
