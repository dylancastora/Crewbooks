import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../hooks/useJobs'
import { useClients } from '../hooks/useClients'
import { useRates } from '../hooks/useRates'
import { useSettings } from '../hooks/useSettings'
import { useExpenses } from '../hooks/useExpenses'
import { getJobItems, setJobItems } from '../services/api/jobItems'
import { generateJobNumber } from '../services/api/jobs'
import { JobStatus, Unit } from '../types'
import { JobForm } from '../components/jobs/JobForm'
import { LineItemEditor } from '../components/jobs/LineItemEditor'
import { JobSummary } from '../components/jobs/JobSummary'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import type { Job, JobItem, Expense } from '../types'

type PartialItem = Omit<JobItem, 'id' | 'jobId' | 'jobNumber' | 'sortOrder' | 'amount'>

function padJobNumber(num: string): string {
  const n = parseInt(num) || 1
  return String(n).padStart(4, '0')
}

export function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { spreadsheetId, getToken } = useAuth()
  const { jobs, createJob, updateJob } = useJobs()
  const { clients, contacts, createClient, createContact } = useClients()
  const { labor, equipment, createRate } = useRates()
  const { settings } = useSettings()
  const { expenses, updateExpense } = useExpenses()
  const { showToast } = useToast()

  const isNew = id === 'new'
  const existingJob = jobs.find((j) => j.id === id)

  const defaultJobNumber = padJobNumber(generateJobNumber(jobs, settings))

  const [formData, setFormData] = useState({
    clientId: '',
    contactIds: '',
    shootDates: '',
    paymentTerms: settings.defaultPaymentTerms || 'Net 30',
    notes: '',
    jobNumber: defaultJobNumber,
  })

  const [items, setItems] = useState<PartialItem[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingItems, setLoadingItems] = useState(!isNew)

  // Compute shoot days from selected dates
  const shootDays = formData.shootDates
    ? formData.shootDates.split(',').map((d) => d.trim()).filter(Boolean).length
    : 0

  // Load existing job data
  useEffect(() => {
    if (existingJob) {
      setFormData({
        clientId: existingJob.clientId,
        contactIds: existingJob.contactIds,
        shootDates: existingJob.shootDates,
        paymentTerms: existingJob.paymentTerms,
        notes: existingJob.notes,
        jobNumber: existingJob.jobNumber,
      })
    }
  }, [existingJob])

  // Load items for existing job
  useEffect(() => {
    if (!existingJob || !spreadsheetId) return
    setLoadingItems(true)
    getToken().then((token) =>
      getJobItems(spreadsheetId, existingJob.id, token),
    ).then((jobItems) => {
      setItems(jobItems.map(({ type, description, date, quantity, rate, taxable }) => ({
        type, description, date, quantity, rate, taxable,
      })))
    }).finally(() => setLoadingItems(false))
  }, [existingJob, spreadsheetId, getToken])

  // Expense linking
  const linkedExpenses = expenses.filter((e) => e.jobId === existingJob?.id)
  const availableExpenses = expenses.filter((e) => e.clientId === formData.clientId && !e.billed)
  const expensesSubtotal = linkedExpenses.reduce((sum, e) => sum + e.amount, 0)

  const handleLinkExpense = useCallback(async (expense: Expense) => {
    await updateExpense({ ...expense, jobId: existingJob?.id || '', billed: true })
  }, [updateExpense, existingJob?.id])

  const handleUnlinkExpense = useCallback(async (expense: Expense) => {
    await updateExpense({ ...expense, jobId: '', billed: false })
  }, [updateExpense])

  const handleCreateRate = useCallback(async (type: 'Labor' | 'Equipment', data: { name: string; rate: number; taxable: boolean }) => {
    await createRate(type, { ...data, unit: Unit.Day, isActive: true })
  }, [createRate])

  // Core save logic — returns the saved job without navigating or toasting
  const saveJob = async (): Promise<Job | undefined> => {
    if (!spreadsheetId) return

    // Validation: require client + at least 1 contact
    if (!formData.clientId) {
      showToast('Please select a client')
      return
    }
    if (!formData.contactIds) {
      showToast('Please select at least one contact')
      return
    }

    // Job number uniqueness check
    const duplicate = jobs.find((j) => j.jobNumber === formData.jobNumber && j.id !== existingJob?.id)
    if (duplicate) {
      showToast(`Job number ${formData.jobNumber} is already in use`)
      return
    }

    const token = await getToken()

    // Build full items with days multiplied in for storage
    const fullItems: JobItem[] = items.map((item, idx) => ({
      ...item,
      id: '',
      jobId: '',
      jobNumber: '',
      sortOrder: idx,
      amount: item.type === 'mileage'
        ? item.quantity * item.rate
        : shootDays * item.quantity * item.rate,
    }))

    if (isNew) {
      const job = await createJob({
        ...formData,
        title: '',
        taxRate: 0,
      }, settings)
      if (job) {
        await setJobItems(spreadsheetId, job.id, job.jobNumber, fullItems.map((item) => ({
          ...item,
          jobId: job.id,
          jobNumber: job.jobNumber,
        })), token)
        return job
      }
    } else if (existingJob) {
      const updatedJob: Job = { ...existingJob, ...formData, title: existingJob.title, taxRate: existingJob.taxRate }
      await updateJob(updatedJob)
      await setJobItems(spreadsheetId, existingJob.id, existingJob.jobNumber, fullItems.map((item) => ({
        ...item,
        jobId: existingJob.id,
        jobNumber: existingJob.jobNumber,
      })), token)
      return updatedJob
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await saveJob()
      if (saved) {
        showToast(isNew ? `Job #${saved.jobNumber} created` : `Job #${saved.jobNumber} saved`)
        navigate('/jobs', { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  const lineItemsReadOnly = existingJob ? ([JobStatus.Invoiced, JobStatus.Paid] as string[]).includes(existingJob.status) : false

  if (!isNew && !existingJob) return <Spinner className="py-12" />
  if (loadingItems) return <Spinner className="py-12" />

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/jobs')} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center text-xl">
          ←
        </button>
        <h1 className="text-2xl font-bold">{isNew ? 'New Job' : `Job #${existingJob?.jobNumber}`}</h1>
      </div>

      <div className="space-y-6">
        <JobForm
          data={formData}
          onChange={setFormData}
          clients={clients}
          contacts={contacts}
          createClient={createClient}
          createContact={createContact}
        />

        <div>
          <h2 className="text-lg font-semibold mb-1">Line Items</h2>
          {shootDays > 0 && (
            <p className="text-sm text-gray-500 mb-3">{shootDays} shoot day{shootDays !== 1 ? 's' : ''} selected — line items multiply by days</p>
          )}
          <LineItemEditor
            items={items}
            onChange={setItems}
            laborRates={labor}
            equipmentRates={equipment}
            settings={settings}
            shootDays={shootDays || 1}
            readOnly={lineItemsReadOnly}
            onCreateRate={handleCreateRate}
            clientId={formData.clientId}
            expenses={[...linkedExpenses, ...availableExpenses]}
            jobId={existingJob?.id}
            onLinkExpense={handleLinkExpense}
            onUnlinkExpense={handleUnlinkExpense}
          />
        </div>

        <JobSummary items={items} taxRate={0} shootDays={shootDays || 1} expensesSubtotal={expensesSubtotal} />

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-white rounded-lg py-3 font-medium min-h-[44px] hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? 'Saving...' : isNew ? 'Create Job' : 'Save Job'}
        </button>
      </div>
    </div>
  )
}
