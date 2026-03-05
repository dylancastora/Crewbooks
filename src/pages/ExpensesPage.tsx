import { useState } from 'react'
import { useExpenses } from '../hooks/useExpenses'
import { useClients } from '../hooks/useClients'
import { useJobs } from '../hooks/useJobs'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { ReceiptUploader } from '../components/expenses/ReceiptUploader'
import { ExpenseCategory } from '../types'
import type { Expense } from '../types'

const categoryOptions = [
  { value: '', label: 'Select category...' },
  { value: ExpenseCategory.Fuel, label: 'Fuel' },
  { value: ExpenseCategory.Meals, label: 'Meals' },
  { value: ExpenseCategory.Equipment, label: 'Equipment' },
  { value: ExpenseCategory.Supplies, label: 'Supplies' },
  { value: ExpenseCategory.Other, label: 'Other' },
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

export function ExpensesPage() {
  const { expenses, loading, createExpense, deleteExpense } = useExpenses()
  const { clients } = useClients()
  const { jobs } = useJobs()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyExpense)
  const [saving, setSaving] = useState(false)
  const [filterJobId, setFilterJobId] = useState('')

  const filteredExpenses = filterJobId
    ? expenses.filter((e) => e.jobId === filterJobId)
    : expenses

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.company || ''
  const getJobLabel = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId)
    return job ? `#${job.jobNumber}` : ''
  }

  const selectedJob = jobs.find((j) => j.id === form.jobId)
  const selectedClient = clients.find((c) => c.id === (form.clientId || selectedJob?.clientId))

  const openNew = () => {
    setForm(emptyExpense)
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Auto-set clientId from selected job
      const clientId = form.clientId || selectedJob?.clientId || ''
      await createExpense({ ...form, clientId } as Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>)
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

      {jobs.length > 0 && (
        <div className="mb-4">
          <Select
            value={filterJobId}
            options={[
              { value: '', label: 'All Jobs' },
              ...jobs.map((j) => ({ value: j.id, label: `#${j.jobNumber} - ${j.title || getClientName(j.clientId)}` })),
            ]}
            onChange={(e) => setFilterJobId(e.target.value)}
          />
        </div>
      )}

      {filteredExpenses.length === 0 ? (
        <EmptyState message="No expenses yet." actionLabel="Add Expense" onAction={openNew} />
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{expense.description}</h3>
                  <p className="text-sm text-gray-500">
                    {expense.date} · {expense.category}
                    {expense.jobId && ` · Job ${getJobLabel(expense.jobId)}`}
                    {expense.receiptFileName && ` · ${expense.receiptFileName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">${expense.amount.toFixed(2)}</span>
                  <Button size="sm" variant="ghost" onClick={() => deleteExpense(expense.id)}>✕</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Expense">
        <div className="space-y-3">
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Amount ($)" type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Category" value={form.category} options={categoryOptions} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Select
            label="Job"
            value={form.jobId}
            options={[
              { value: '', label: 'No job' },
              ...jobs.map((j) => ({ value: j.id, label: `#${j.jobNumber} - ${j.title || getClientName(j.clientId)}` })),
            ]}
            onChange={(e) => setForm({ ...form, jobId: e.target.value })}
          />
          <Select
            label="Client"
            value={form.clientId || selectedJob?.clientId || ''}
            options={[
              { value: '', label: 'Select client...' },
              ...clients.map((c) => ({ value: c.id, label: c.company })),
            ]}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          />
          <ReceiptUploader
            jobNumber={selectedJob?.jobNumber}
            clientCompany={selectedClient?.company}
            existingFileName={form.receiptFileName}
            onUpload={(fileId, fileName) => setForm({ ...form, receiptFileId: fileId, receiptFileName: fileName })}
          />
          <Button onClick={handleSave} disabled={saving || !form.description} className="w-full">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
