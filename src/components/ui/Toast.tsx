import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

interface ToastState {
  message: string
  visible: boolean
}

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false })

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true })
  }, [])

  useEffect(() => {
    if (!toast.visible) return
    const timer = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000)
    return () => clearTimeout(timer)
  }, [toast.visible])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.visible && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in max-w-[90vw]">
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
