import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendEmail } from '../services/google/gmail'
import { escapeHtml, sanitizeHeaderValue } from '../utils/sanitize'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'

export function MorePage() {
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
    <div>
      <h1 className="text-2xl font-bold mb-6">More</h1>
      {user && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            {user.picture && (
              <img src={user.picture} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            )}
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        <Link to="/rates" className="block">
          <Card>Rates</Card>
        </Link>
        <Link to="/settings" className="block">
          <Card>Settings</Card>
        </Link>
      </div>
      <div className="mt-8 space-y-3">
        <Button variant="secondary" onClick={() => setShowSupport(true)} className="w-full">
          Contact Support
        </Button>
        <Button variant="danger" onClick={signOut} className="w-full">
          Sign Out
        </Button>
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
    </div>
  )
}
