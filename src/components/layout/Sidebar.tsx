import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sendEmail } from '../../services/google/gmail'
import { sanitizeHeaderValue, escapeHtml } from '../../utils/sanitize'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  { to: '/jobs', label: 'Jobs', icon: '◫' },
  { to: '/clients', label: 'Clients', icon: '⊡' },
  { to: '/expenses', label: 'Expenses', icon: '⊘' },
  { to: '/rates', label: 'Rates', icon: '$' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export function Sidebar() {
  const { user, signOut, getToken } = useAuth()
  const { showToast } = useToast()
  const [showSupport, setShowSupport] = useState(false)
  const [supportForm, setSupportForm] = useState({ topic: '', body: '' })
  const [sending, setSending] = useState(false)

  const handleSendSupport = async () => {
    setSending(true)
    try {
      const token = await getToken()
      const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'dylancastora@gmail.com'
      await sendEmail(token, {
        to: [supportEmail],
        subject: sanitizeHeaderValue(`[CrewBooks Support] ${supportForm.topic}`),
        html: `<div style="font-family: Arial, sans-serif;">
          <p><strong>From:</strong> ${escapeHtml(user?.name || 'Unknown')} (${escapeHtml(user?.email || 'Unknown')})</p>
          <p><strong>Topic:</strong> ${escapeHtml(supportForm.topic)}</p>
          <hr/>
          <p>${escapeHtml(supportForm.body).replace(/\n/g, '<br/>')}</p>
        </div>`,
      })
      setShowSupport(false)
      setSupportForm({ topic: '', body: '' })
      showToast('Support message sent')
    } catch (err) {
      console.error('Failed to send support email:', err instanceof Error ? err.message : 'Unknown error')
      showToast('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-4 border-b border-gray-200 flex items-center " style={{paddingTop: '20px'}}>
        <>
          <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800&display=swap" rel="stylesheet" />
          <div className="flex items-center mb-2 max-w-sm mx-auto">
            <svg style={{ width: '100%', height: 'auto' }} viewBox="0 0 248 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="13.39" width="7.3" height="12.17" rx="1.82" fill="#2563EB" opacity="0.4"/>
              <rect x="11.3" y="6.09" width="7.3" height="19.47" rx="1.82" fill="#2563EB" opacity="0.65"/>
              <rect x="22.6" y="0" width="7.3" height="25.56" rx="1.82" fill="#2563EB"/>
              <text x="41.9" y="25.56" font-family="Rubik, sans-serif" font-weight="800" font-size="36" fill="black">Crewbooks</text>
            </svg>
          </div>
        </>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium ${isActive ? 'text-primary bg-primary/5 border-r-2 border-primary' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200">
        <button
          onClick={() => setShowSupport(true)}
          className="flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium text-gray-600 hover:bg-gray-50 w-full text-left"
        >
          Contact Support
        </button>
        <NavLink
          to="/privacy-policy"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium ${isActive ? 'text-primary bg-primary/5' : 'text-gray-600 hover:bg-gray-50'}`
          }
        >
          Privacy Policy
        </NavLink>
        <NavLink
          to="/terms-of-service"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium ${isActive ? 'text-primary bg-primary/5' : 'text-gray-600 hover:bg-gray-50'}`
          }
        >
          Terms of Service
        </NavLink>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium text-red-600 hover:bg-red-50 w-full text-left"
        >
          Sign Out
        </button>
      </div>

      <Modal open={showSupport} onClose={() => setShowSupport(false)} title="Contact Support">
        <div className="space-y-3">
          <Input
            label="Topic"
            value={supportForm.topic}
            onChange={(e) => setSupportForm({ ...supportForm, topic: e.target.value })}
            autoComplete="off"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={supportForm.body}
              onChange={(e) => setSupportForm({ ...supportForm, body: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
          <Button
            onClick={handleSendSupport}
            disabled={sending || !supportForm.topic || !supportForm.body}
            className="w-full"
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </Modal>
    </aside>
  )
}
