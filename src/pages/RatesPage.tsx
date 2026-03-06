import { useState } from 'react'
import { useRates } from '../hooks/useRates'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Unit } from '../types'
import type { LaborRate, EquipmentRate } from '../types'

type RateType = 'Labor' | 'Equipment'
type Rate = LaborRate | EquipmentRate

const emptyRate = { name: '', rate: 0, unit: Unit.Day as string, taxable: false, isActive: true }

export function RatesPage() {
  const { labor, equipment, loading, createRate, updateRate, deleteRate } = useRates()
  const [activeTab, setActiveTab] = useState<RateType>('Labor')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Rate | null>(null)
  const [form, setForm] = useState(emptyRate)
  const [saving, setSaving] = useState(false)

  const rates = activeTab === 'Labor' ? labor : equipment

  const openNew = () => {
    setEditing(null)
    setForm({ ...emptyRate, taxable: activeTab === 'Equipment' })
    setShowModal(true)
  }

  const openEdit = (rate: Rate) => {
    setEditing(rate)
    setForm({ name: rate.name, rate: rate.rate, unit: rate.unit, taxable: rate.taxable, isActive: rate.isActive })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await updateRate(activeTab, { ...editing, ...form, rate: Number(form.rate), taxable: form.taxable, isActive: form.isActive } as Rate)
      } else {
        await createRate(activeTab, { ...form, rate: Number(form.rate) } as Omit<Rate, 'id' | 'createdAt' | 'updatedAt'>)
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await deleteRate(activeTab, editing.id)
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner className="py-12" />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rates</h1>
        <Button onClick={openNew} size="sm">+ Add Rate</Button>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {(['Labor', 'Equipment'] as RateType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium min-h-[44px] transition-colors ${activeTab === tab ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
          >
            {tab === 'Equipment' ? 'Gear' : tab}
          </button>
        ))}
      </div>

      {rates.length === 0 ? (
        <EmptyState message={`No ${activeTab === 'Equipment' ? 'gear' : 'labor'} rates yet.`} actionLabel="Add Rate" onAction={openNew} />
      ) : (
        <div className="space-y-2">
          {rates.map((rate) => (
            <Card key={rate.id} onClick={() => openEdit(rate)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{rate.name}</h3>
                  <p className="text-sm text-gray-500">
                    ${rate.rate}/day
                    {rate.taxable && ' · Taxable'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(e) => { e.stopPropagation(); deleteRate(activeTab, rate.id) }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? `Edit Day Rate` : `New ${activeTab === 'Equipment' ? 'Gear' : 'Labor'} Day Rate`}>
        <div className="space-y-3">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />
          <Input label="Day Rate ($)" type="number" step="0.01" value={form.rate || ''} onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} autoComplete="off" />
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} className="w-5 h-5 rounded" />
            <span className="text-sm">Taxable</span>
          </label>
          <Button onClick={handleSave} disabled={saving || !form.name} className="w-full">
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {editing && (
            <Button variant="danger" onClick={handleDelete} disabled={saving} className="w-full">
              Delete Rate
            </Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
