import { useRegisterSW } from 'virtual:pwa-register/react'
import { useState, useEffect } from 'react'
import { Button } from './ui/Button'

export function PWAPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-warning text-white text-center py-2 text-sm z-50 font-medium">
          You're offline. Some features may be unavailable.
        </div>
      )}
      {needRefresh && (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white shadow-lg rounded-xl border border-gray-200 p-4 z-50">
          <p className="text-sm font-medium mb-2">A new version is available</p>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>Update Now</Button>
        </div>
      )}
    </>
  )
}
