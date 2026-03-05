declare namespace google.accounts.oauth2 {
  interface TokenClient {
    callback: (response: TokenResponse) => void
    error_callback: (error: ClientConfigError) => void
    requestAccessToken: (overrides?: { prompt?: string }) => void
  }

  interface TokenResponse {
    access_token: string
    expires_in: string
    error?: string
    scope: string
    token_type: string
  }

  interface ClientConfigError {
    type: string
    message?: string
  }

  function initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: ClientConfigError) => void
  }): TokenClient

  function revoke(token: string, callback: () => void): void
}
