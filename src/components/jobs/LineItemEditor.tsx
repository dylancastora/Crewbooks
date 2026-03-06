import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { ItemType } from '../../types'
import type { JobItem, LaborRate, EquipmentRate, Settings } from '../../types'

type PartialItem = Omit<JobItem, 'id' | 'jobId' | 'jobNumber' | 'sortOrder' | 'amount'>

interface LineItemEditorProps {
  items: PartialItem[]
  onChange: (items: PartialItem[]) => void
  laborRates: LaborRate[]
  equipmentRates: EquipmentRate[]
  settings: Settings
  shootDays: number
  readOnly?: boolean
  onCreateRate?: (type: 'Labor' | 'Equipment', data: { name: string; rate: number; taxable: boolean }) => Promise<void>
}

const typeOptions = [
  { value: ItemType.Labor, label: 'Labor' },
  { value: ItemType.Equipment, label: 'Equipment' },
  { value: ItemType.Mileage, label: 'Mileage' },
  { value: ItemType.Custom, label: 'Custom' },
]

export function LineItemEditor({ items, onChange, laborRates, equipmentRates, settings, shootDays, readOnly, onCreateRate }: LineItemEditorProps) {
  const [activeTab, setActiveTab] = useState<string>(ItemType.Labor)
  const [showNewRateModal, setShowNewRateModal] = useState(false)
  const [newRateForm, setNewRateForm] = useState({ name: '', rate: 0, taxable: false, saveToRates: false })

  const addFromRate = (rate: LaborRate | EquipmentRate, type: string) => {
    const newItem: PartialItem = {
      type: type as ItemType,
      description: rate.name,
      date: '',
      quantity: 1,
      rate: rate.rate,
      taxable: rate.taxable,
    }
    onChange([...items, newItem])
  }

  const addMileage = () => {
    const mileageRate = parseFloat(settings.mileageRate || '0.70')
    const newItem: PartialItem = {
      type: ItemType.Mileage,
      description: `Mileage (0 mi @ $${mileageRate}/mi)`,
      date: '',
      quantity: 0,
      rate: mileageRate,
      taxable: false,
    }
    onChange([...items, newItem])
  }

  const addCustom = () => {
    const newItem: PartialItem = {
      type: ItemType.Custom,
      description: '',
      date: '',
      quantity: 1,
      rate: 0,
      taxable: false,
    }
    onChange([...items, newItem])
  }

  const openNewInlineRate = () => {
    setNewRateForm({ name: '', rate: 0, taxable: activeTab === 'equipment', saveToRates: false })
    setShowNewRateModal(true)
  }

  const handleCreateInlineRate = async () => {
    const newItem: PartialItem = {
      type: activeTab as ItemType,
      description: newRateForm.name,
      date: '',
      quantity: 1,
      rate: newRateForm.rate,
      taxable: newRateForm.taxable,
    }
    onChange([...items, newItem])

    if (newRateForm.saveToRates && onCreateRate) {
      const rateType = activeTab === ItemType.Labor ? 'Labor' : 'Equipment'
      await onCreateRate(rateType, { name: newRateForm.name, rate: newRateForm.rate, taxable: newRateForm.taxable })
    }

    setShowNewRateModal(false)
  }

  const updateItem = (idx: number, updates: Partial<PartialItem>) => {
    const updated = [...items]
    const item = { ...updated[idx], ...updates }
    // Auto-update mileage description
    if (item.type === ItemType.Mileage && ('quantity' in updates || 'rate' in updates)) {
      item.description = `Mileage (${item.quantity} mi @ $${item.rate}/mi)`
    }
    updated[idx] = item
    onChange(updated)
  }

  const removeItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx)
    onChange(updated)
  }

  const tabItems = items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.type === activeTab)
  const activeRates = (activeTab === ItemType.Labor
    ? laborRates.filter((r) => r.isActive)
    : activeTab === ItemType.Equipment
      ? equipmentRates.filter((r) => r.isActive)
      : []
  ).filter((rate) => !items.some((item) => item.description === rate.name && item.type === activeTab))

  const calcLineTotal = (item: PartialItem) => {
    if (item.type === ItemType.Mileage) return item.quantity * item.rate
    return shootDays * item.quantity * item.rate
  }

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {typeOptions.map((opt) => {
          const count = items.filter((i) => i.type === opt.value).length
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActiveTab(opt.value)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium min-h-[36px] whitespace-nowrap transition-colors ${activeTab === opt.value ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
            >
              {opt.label}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Quick add from saved rates */}
      {!readOnly && activeRates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeRates.map((rate) => (
            <Button
              key={rate.id}
              size="sm"
              variant="secondary"
              onClick={() => addFromRate(rate, activeTab)}
            >
              + {rate.name} (${rate.rate}/day)
            </Button>
          ))}
        </div>
      )}

      {/* Line items for active tab */}
      <div className="space-y-3">
        {tabItems.map(({ item, idx }) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{item.description || 'Untitled'}</span>
              {!readOnly && <Button size="sm" variant="danger" onClick={() => removeItem(idx)}>Remove</Button>}
            </div>
            {item.type === ItemType.Custom && (
              <div className="mb-2">
                <Input
                  label="Description"
                  value={item.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  autoComplete="off"
                  disabled={readOnly}
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Input
                label={item.type === ItemType.Mileage ? 'Miles' : 'Qty'}
                type="number"
                step="0.01"
                value={item.quantity || ''}
                onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                autoComplete="off"
                disabled={readOnly}
              />
              <Input
                label={item.type === ItemType.Mileage ? '$/mi' : 'Day Rate ($)'}
                type="number"
                step="0.01"
                value={item.rate || ''}
                onChange={(e) => updateItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                autoComplete="off"
                disabled={readOnly}
              />
              <div className="flex items-end pb-1">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">
                    {item.type !== ItemType.Mileage && shootDays > 0 ? `${shootDays}d × ${item.quantity} × $${item.rate}` : ''}
                  </p>
                  <span className="text-sm font-medium text-gray-700">
                    = ${calcLineTotal(item).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.taxable}
                onChange={(e) => updateItem(idx, { taxable: e.target.checked })}
                className="w-4 h-4 rounded"
                disabled={readOnly}
              />
              <span className="text-sm">Taxable</span>
            </label>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeTab === ItemType.Mileage ? (
            <Button size="sm" variant="secondary" onClick={addMileage}>+ Add Mileage</Button>
          ) : activeTab === ItemType.Custom ? (
            <Button size="sm" variant="secondary" onClick={addCustom}>+ Add Custom Item</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={openNewInlineRate}>+ New {activeTab === 'labor' ? 'Labor' : 'Equipment'} Rate</Button>
          )}
        </div>
      )}

      <Modal open={showNewRateModal} onClose={() => setShowNewRateModal(false)} title={`New ${activeTab === ItemType.Labor ? 'Labor' : 'Equipment'} Rate`}>
        <div className="space-y-3">
          <Input label="Name / Description" value={newRateForm.name} onChange={(e) => setNewRateForm({ ...newRateForm, name: e.target.value })} autoComplete="off" />
          <Input label="Day Rate ($)" type="number" step="0.01" value={newRateForm.rate || ''} onChange={(e) => setNewRateForm({ ...newRateForm, rate: parseFloat(e.target.value) || 0 })} autoComplete="off" />
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={newRateForm.taxable} onChange={(e) => setNewRateForm({ ...newRateForm, taxable: e.target.checked })} className="w-5 h-5 rounded" />
            <span className="text-sm">Taxable</span>
          </label>
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={newRateForm.saveToRates} onChange={(e) => setNewRateForm({ ...newRateForm, saveToRates: e.target.checked })} className="w-5 h-5 rounded" />
            <span className="text-sm">Save to Rates menu</span>
          </label>
          <Button onClick={handleCreateInlineRate} disabled={!newRateForm.name} className="w-full">
            Add Item
          </Button>
        </div>
      </Modal>
    </div>
  )
}
