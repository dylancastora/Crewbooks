import type { ReactNode } from 'react'
import { createContext, useContext, useState, useCallback } from 'react'
import { initTokenClient, requestAccessToken, getValidToken, clearToken, getUserInfo } from '../services/google/auth'
import { initializeUserWorkspace } from '../services/api/init'
import type { UserInfo, Workspace } from '../types'

interface AuthState {
  user: UserInfo | null
  accessToken: string | null
  spreadsheetId: string | null
  rootFolderId: string | null
  receiptsFolderId: string | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => void
  getToken: () => Promise<string>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const signIn = useCallback(async () => {
    setIsLoading(true)
    try {
      await initTokenClient()
      const token = await requestAccessToken()
      setAccessToken(token)

      const [userInfo, ws] = await Promise.all([
        getUserInfo(token),
        initializeUserWorkspace(token),
      ])

      setUser(userInfo)
      setWorkspace(ws)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signOut = useCallback(() => {
    clearToken()
    setUser(null)
    setAccessToken(null)
    setWorkspace(null)
  }, [])

  const getToken = useCallback(async (): Promise<string> => {
    const valid = getValidToken()
    if (valid) return valid
    // Token expired — re-auth
    await initTokenClient()
    const token = await requestAccessToken()
    setAccessToken(token)
    return token
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        spreadsheetId: workspace?.spreadsheetId ?? null,
        rootFolderId: workspace?.rootFolderId ?? null,
        receiptsFolderId: workspace?.receiptsFolderId ?? null,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        signIn,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
