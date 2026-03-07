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
    <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-4 border-b border-gray-200">
        <>
          <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800&display=swap" rel="stylesheet" />
          <h1 style={{ fontFamily: "'Rubik', Sans-Serif" }} className="text-3xl font-extrabold text-primary mb-2">Crewbooks</h1>
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
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium ${isActive ? 'text-primary bg-primary/5' : 'text-gray-600 hover:bg-gray-50'}`
          }
        >
          <span className="text-lg">⚙</span>
          Settings
        </NavLink>
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
