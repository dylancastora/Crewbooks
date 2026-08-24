import { useMemo, useState } from 'react'
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
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { EmptyState } from '../components/ui/EmptyState'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { ReceiptUploader } from '../components/expenses/ReceiptUploader'
import { formatDate } from '../utils/formatDate'
import { ExpenseCategory } from '../types'
import { matchesExpenseStatus, expenseStatus } from '../utils/expenseLinks'
import type { ExpenseStatusFilter } from '../utils/expenseLinks'
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

const statusFilterOptions: { value: ExpenseStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'billed', label: 'Billed' },
  { value: 'unbilled', label: 'Unbilled' },
  { value: 'internal', label: 'Internal' },
]

type SortField = 'date' | 'amount' | 'client' | 'category'

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'client', label: 'Client' },
  { value: 'category', label: 'Category' },
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
  const [filterStatus, setFilterStatus] = useState<ExpenseStatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortField>('date')
  // Most recent first — the expense you just entered is the one you're looking at.
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.company || ''

  const visibleExpenses = useMemo(() => {
    const companyById = new Map(clients.map((c) => [c.id, c.company]))
    const filtered = expenses.filter((e) => (
      (!filterCategory || e.category === filterCategory) && matchesExpenseStatus(e, filterStatus)
    ))

    return filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') {
        cmp = a.date.localeCompare(b.date)
      } else if (sortBy === 'amount') {
        cmp = a.amount - b.amount
      } else if (sortBy === 'client') {
        cmp = (companyById.get(a.clientId) || '').localeCompare(companyById.get(b.clientId) || '')
      } else {
        cmp = a.category.localeCompare(b.category)
      }
      // Same date or category — break the tie on amount to keep the order stable.
      if (cmp === 0 && sortBy !== 'amount') cmp = a.amount - b.amount
      return sortAsc ? cmp : -cmp
    })
  }, [expenses, clients, filterCategory, filterStatus, sortBy, sortAsc])

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

  if (loading) return <LoadingScreen />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={openNew} size="sm">+ Add Expense</Button>
      </div>

      <div className="flex gap-2 mb-2 items-end">
        <div className="w-full">
          <p className="text-xs text-gray-500 mb-1">Status</p>
          <Select
            value={filterStatus}
            options={statusFilterOptions}
            onChange={(e) => setFilterStatus(e.target.value as ExpenseStatusFilter)}
          />
        </div>
        <div className="w-full">
          <p className="text-xs text-gray-500 mb-1">Category</p>
          <Select
            value={filterCategory}
            options={filterCategoryOptions}
            onChange={(e) => setFilterCategory(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4 items-end">
        <div className="w-full">
          <p className="text-xs text-gray-500 mb-1">Sort by</p>
          <Select
            value={sortBy}
            options={sortOptions}
            onChange={(e) => setSortBy(e.target.value as SortField)}
          />
        </div>
        <button
          type="button"
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors text-lg"
          title={sortAsc ? 'Ascending' : 'Descending'}
        >
          {sortAsc ? '↑' : '↓'}
        </button>
      </div>

      {visibleExpenses.length === 0 ? (
        <EmptyState
          message={expenses.length === 0 ? 'No expenses yet.' : 'No expenses match these filters.'}
          actionLabel="Add Expense"
          onAction={openNew}
        />
      ) : (
        <div className="space-y-2">
          {visibleExpenses.map((expense) => (
            <Card key={expense.id}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{expense.description}</h3>
                    {expenseStatus(expense) === 'billed' && (
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
