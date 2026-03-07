import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenses } from '../hooks/useExpenses'
import { useClients } from '../hooks/useClients'
import { useJobs } from '../hooks/useJobs'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { ReceiptUploader } from '../components/expenses/ReceiptUploader'
import { formatDate } from '../utils/formatDate'
import { ExpenseCategory } from '../types'
import type { Expense } from '../types'

const categoryOptions = [
  { value: '', label: 'Select category...' },
  { value: ExpenseCategory.Fuel, label: 'Fuel' },
  { value: ExpenseCategory.Meals, label: 'Meals' },
  { value: ExpenseCategory.Equipment, label: 'Equipment' },
  { value: ExpenseCategory.Supplies, label: 'Supplies' },
  { value: ExpenseCategory.Rentals, label: 'Rentals' },
  { value: ExpenseCategory.Parking, label: 'Parking' },
  { value: ExpenseCategory.Other, label: 'Other' },
]

const filterCategoryOptions = [
  { value: '', label: 'All Categories' },
  ...categoryOptions.slice(1),
]

const emptyExpense = {
  description: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  category: '' as string,
  jobId: '',
  clientId: '',
  receiptFileId: '',
  receiptFileName: '',
}

function ReceiptThumbnail({ fileId }: { fileId: string }) {
  const { getToken } = useAuth()
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  if (!fileId || failed) return null

  if (!src) {
    getToken().then((token) => {
      fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.blob())
        .then((blob) => setSrc(URL.createObjectURL(blob)))
        .catch(() => setFailed(true))
    })
    return <div className="w-20 h-20 bg-gray-100 rounded animate-pulse mt-2" />
  }

  return (
    <img
      src={src}
      alt="Receipt"
      className="w-20 h-20 object-cover rounded mt-2 border"
    />
  )
}

export function ExpensesPage() {
  const navigate = useNavigate()
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses()
  const { clients } = useClients()
  const { jobs } = useJobs()
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState(emptyExpense)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredExpenses = filterCategory
    ? expenses.filter((e) => e.category === filterCategory)
    : expenses

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.company || ''

  const selectedClient = clients.find((c) => c.id === form.clientId)

  const openNew = () => {
    setEditingExpense(null)
    setForm(emptyExpense)
    setShowModal(true)
  }

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setForm({
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      category: expense.category,
      jobId: expense.jobId,
      clientId: expense.clientId,
      receiptFileId: expense.receiptFileId,
      receiptFileName: expense.receiptFileName,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingExpense) {
        await updateExpense({
          ...editingExpense,
          ...form,
          billed: editingExpense.billed,
        } as Expense)
      } else {
        await createExpense({ ...form, billed: false } as Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>)
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner className="py-12" />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={openNew} size="sm">+ Add Expense</Button>
      </div>

      <div className="mb-4">
        <Select
          value={filterCategory}
          options={filterCategoryOptions}
          onChange={(e) => setFilterCategory(e.target.value)}
        />
      </div>

      {filteredExpenses.length === 0 ? (
        <EmptyState message="No expenses yet." actionLabel="Add Expense" onAction={openNew} />
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{expense.description}</h3>
                    {expense.billed && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Billed</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatDate(expense.date)} · {expense.category}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">${expense.amount.toFixed(2)}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      items={[
                        { label: 'Edit', onClick: () => openEdit(expense) },
                        { label: 'Delete', onClick: () => deleteExpense(expense.id), isDanger: true },
                      ]}
                    />
                  </div>
                </div>
              </div>
              {expandedId === expense.id && (
                <div className="mt-3 pt-3 border-t text-sm text-gray-600 space-y-1">
                  {expense.clientId && <p><span className="text-gray-400">Client:</span> {getClientName(expense.clientId)}</p>}
                  {expense.billed && expense.jobId && (() => {
                    const job = jobs.find((j) => j.id === expense.jobId)
                    return job ? (
                      <p>
                        <span className="text-gray-400">Attached to: </span>
                        <button
                          type="button"
                          className="text-primary hover:underline font-medium"
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}
                        >
                          Job #{job.jobNumber}
                        </button>
                      </p>
                    ) : null
                  })()}
                  {expense.receiptFileName && <p><span className="text-gray-400">Receipt:</span> {expense.receiptFileName}</p>}
                  {expense.receiptFileId && <ReceiptThumbnail fileId={expense.receiptFileId} />}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingExpense ? 'Edit Expense' : 'New Expense'}>
        <div className="space-y-3">
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Amount ($)" type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Category" value={form.category} options={categoryOptions} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Select
            label="Client"
            value={form.clientId}
            options={[
              { value: '', label: 'Select client...' },
              ...clients.map((c) => ({ value: c.id, label: c.company })),
            ]}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          />
          <ReceiptUploader
            jobNumber={undefined}
            clientCompany={selectedClient?.company}
            existingFileName={form.receiptFileName}
            description={form.description}
            date={form.date}
            onUpload={(fileId, fileName) => setForm({ ...form, receiptFileId: fileId, receiptFileName: fileName })}
          />
          <Button onClick={handleSave} disabled={saving || !form.description} className="w-full">
            {saving ? 'Saving...' : editingExpense ? 'Save' : 'Add Expense'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
