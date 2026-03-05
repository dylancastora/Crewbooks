import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PWAPrompt } from './components/PWAPrompt.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PWAPrompt />
  </StrictMode>,
)
