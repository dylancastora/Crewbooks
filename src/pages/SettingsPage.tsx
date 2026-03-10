import { useState, useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'

const fields = [
  { key: 'businessName', label: 'Business Name', type: 'text', autoComplete: 'organization' },
  { key: 'businessAddress', label: 'Business Address', type: 'text', autoComplete: 'street-address' },
  { key: 'businessPhone', label: 'Business Phone', type: 'text', autoComplete: 'tel' },
  { key: 'businessEmail', label: 'Business Email', type: 'email', autoComplete: 'email' },
  { key: 'mileageRate', label: 'Mileage Rate ($/mi)', type: 'number', autoComplete: 'off' },
  { key: 'defaultPaymentTerms', label: 'Default Payment Terms', type: 'text', autoComplete: 'off' },
  { key: 'defaultPaymentWindow', label: 'Default Payment Window (days)', type: 'number', autoComplete: 'off' },
  { key: 'defaultTaxRate', label: 'Default Sales Tax Rate (%)', type: 'number', autoComplete: 'off' },
] as const

export function SettingsPage() {
  const { settings, updateSettings, loading, reload } = useSettings()
  const { showToast } = useToast()
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setForm({ ...settings })
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(form)
      await reload()
      setEditing(false)
      showToast('Settings saved')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({ ...settings })
    setEditing(false)
  }

  if (loading) return <Spinner className="py-12" />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        {!editing && (
          <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      <div className="space-y-4 max-w-md">
        {editing ? (
          <>
            {fields.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type={f.type}
                step={f.type === 'number' ? '0.01' : undefined}
                value={form[f.key] || ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                autoComplete={f.autoComplete}
              />
            ))}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button onClick={handleCancel} variant="secondary" className="flex-1">
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key}>
                <p className="text-sm text-gray-500">{f.label}</p>
                <p className="font-medium">{settings[f.key] || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
