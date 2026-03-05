import type { UserInfo } from '../../types'

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ')

let tokenClient: google.accounts.oauth2.TokenClient | null = null
let currentToken: string | null = null
let tokenExpiry: number = 0

export function initTokenClient(): Promise<void> {
  return new Promise((resolve) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || clientId === 'your-client-id-here.apps.googleusercontent.com') {
      console.warn('Google Client ID not configured in .env.local')
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: () => {}, // overridden per-call
    })
    resolve()
  })
}

export function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Token client not initialized'))
      return
    }
    tokenClient.callback = (response: google.accounts.oauth2.TokenResponse) => {
      if (response.error) {
        reject(new Error(response.error))
        return
      }
      currentToken = response.access_token
      tokenExpiry = Date.now() + (parseInt(response.expires_in) * 1000)
      resolve(response.access_token)
    }
    tokenClient.error_callback = (error: google.accounts.oauth2.ClientConfigError) => {
      reject(new Error(error.message || 'Token request failed'))
    }
    tokenClient.requestAccessToken()
  })
}

export function getValidToken(): string | null {
  if (currentToken && Date.now() < tokenExpiry - 60000) {
    return currentToken
  }
  return null
}

export function clearToken(): void {
  if (currentToken) {
    google.accounts.oauth2.revoke(currentToken, () => {})
  }
  currentToken = null
  tokenExpiry = 0
}

export async function getUserInfo(token: string): Promise<UserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user info')
  const data = await res.json()
  return { name: data.name, email: data.email, picture: data.picture }
}
