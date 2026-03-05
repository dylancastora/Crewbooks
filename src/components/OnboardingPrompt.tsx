import { useState, useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Button } from './ui/Button'

export function OnboardingPrompt() {
  const { settings, updateSettings, loading } = useSettings()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !settings.businessName) {
      setShow(true)
      setForm({
        businessName: settings.businessName || '',
        businessAddress: settings.businessAddress || '',
        businessPhone: settings.businessPhone || '',
        businessEmail: settings.businessEmail || '',
      })
    }
  }, [loading, settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(form)
      setShow(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={show} onClose={() => setShow(false)} title="Welcome! Set up your business info">
      <p className="text-sm text-gray-500 mb-4">This information will appear on your quotes and invoices.</p>
      <div className="space-y-3">
        <Input label="Business Name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} autoComplete="organization" />
        <Input label="Business Address" value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} autoComplete="street-address" />
        <Input label="Business Phone" type="tel" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} autoComplete="tel" />
        <Input label="Business Email" type="email" value={form.businessEmail} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} autoComplete="email" />
        <Button onClick={handleSave} disabled={saving || !form.businessName} className="w-full">
          {saving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </Modal>
  )
}
