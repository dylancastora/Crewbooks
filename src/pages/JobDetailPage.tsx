import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../hooks/useJobs'
import { useClients } from '../hooks/useClients'
import { useRates } from '../hooks/useRates'
import { useSettings } from '../hooks/useSettings'
import { useExpenses } from '../hooks/useExpenses'
import { useDataContext } from '../context/DataProvider'
import { getJobItems, setJobItems } from '../services/api/jobItems'
import { generateJobNumber } from '../services/api/jobs'
import { JobStatus, Unit } from '../types'
import { JobForm } from '../components/jobs/JobForm'
import { LineItemEditor } from '../components/jobs/LineItemEditor'
import { JobSummary } from '../components/jobs/JobSummary'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { formatDate as formatDateDisplay } from '../utils/formatDate'
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
  const { setAllItems } = useDataContext()
  const { showToast } = useToast()

  const isNew = id === 'new'
  const existingJob = jobs.find((j) => j.id === id)
  const defaultTaxRate = parseFloat(settings.defaultTaxRate) || 0

  const [formData, setFormData] = useState({
    clientId: '',
    contactIds: '',
    shootDates: '',
    paymentTerms: settings.defaultPaymentTerms || 'Net 30',
    paymentWindow: settings.defaultPaymentWindow || '30',
    notes: '',
    jobNumber: '',
    taxRate: defaultTaxRate,
  })

  const [items, setItems] = useState<PartialItem[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingItems, setLoadingItems] = useState(!isNew)
  const [pendingLinks, setPendingLinks] = useState<Expense[]>([])
  const [pendingUnlinks, setPendingUnlinks] = useState<Expense[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const initialLoadDone = useRef(false)

  // Track changes after initial load
  const handleFormChange = useCallback((data: { clientId: string; contactIds: string; shootDates: string; paymentTerms: string; paymentWindow: string; notes: string; jobNumber: string }) => {
    setFormData((prev) => ({ ...prev, ...data }))
    if (initialLoadDone.current) setIsDirty(true)
  }, [])
  const handleItemsChange = useCallback((newItems: PartialItem[]) => {
    setItems(newItems)
    if (initialLoadDone.current) setIsDirty(true)
  }, [])

  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [conflicts, setConflicts] = useState<{ date: string; jobNumber: string; clientName: string }[]>([])
  const skipConflictCheck = useRef(false)

  // Unsaved changes guard — tab close / refresh
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowLeaveModal(true)
    } else {
      navigate('/')
    }
  }, [isDirty, navigate])

  // Compute shoot days from selected dates
  const shootDays = formData.shootDates
    ? formData.shootDates.split(',').map((d) => d.trim()).filter(Boolean).length
    : 0

  // Dates booked by other (non-cancelled) jobs
  const bookedDates = useMemo(() => {
    const dates = new Set<string>()
    jobs.forEach((j) => {
      if (j.id === existingJob?.id || j.cancelled) return
      j.shootDates.split(',').map((d) => d.trim()).filter(Boolean).forEach((d) => dates.add(d))
    })
    return Array.from(dates)
  }, [jobs, existingJob?.id])

  // Map of booked date → conflicting jobs (for the warning modal)
  const bookedDateMap = useMemo(() => {
    const map = new Map<string, { jobNumber: string; clientName: string }[]>()
    jobs.forEach((j) => {
      if (j.id === existingJob?.id || j.cancelled) return
      const client = clients.find((c) => c.id === j.clientId)
      j.shootDates.split(',').map((d) => d.trim()).filter(Boolean).forEach((d) => {
        const entry = { jobNumber: j.jobNumber, clientName: client?.company || 'Unknown' }
        map.set(d, [...(map.get(d) || []), entry])
      })
    })
    return map
  }, [jobs, existingJob?.id, clients])

  // Set job number for new jobs once jobs list has loaded
  useEffect(() => {
    if (!isNew) return
    setFormData((prev) => ({
      ...prev,
      jobNumber: padJobNumber(generateJobNumber(jobs, settings)),
      taxRate: parseFloat(settings.defaultTaxRate) || 0,
    }))
    // Mark initial load done for new jobs (no items to load)
    if (isNew) initialLoadDone.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, jobs, settings])

  // Load existing job data
  useEffect(() => {
    if (existingJob) {
      setFormData({
        clientId: existingJob.clientId,
        contactIds: existingJob.contactIds,
        shootDates: existingJob.shootDates,
        paymentTerms: existingJob.paymentTerms,
        paymentWindow: String(existingJob.paymentWindow),
        notes: existingJob.notes,
        jobNumber: existingJob.jobNumber,
        taxRate: existingJob.taxRate || defaultTaxRate,
      })
    }
  }, [existingJob, defaultTaxRate])

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
    }).finally(() => {
      setLoadingItems(false)
      initialLoadDone.current = true
    })
  }, [existingJob, spreadsheetId, getToken])

  // Expense linking — deferred until save
  const pendingLinkIds = new Set(pendingLinks.map((e) => e.id))
  const pendingUnlinkIds = new Set(pendingUnlinks.map((e) => e.id))
  const linkedExpenses = [
    ...expenses.filter((e) => e.jobId === existingJob?.id && !pendingUnlinkIds.has(e.id)),
    ...pendingLinks,
  ]
  const availableExpenses = [
    ...expenses.filter((e) => e.clientId === formData.clientId && !e.billed && !pendingLinkIds.has(e.id)),
    ...pendingUnlinks,
  ]
  const expensesSubtotal = linkedExpenses.reduce((sum, e) => sum + e.amount, 0)

  const handleLinkExpense = useCallback((expense: Expense) => {
    setPendingUnlinks((prev) => prev.filter((e) => e.id !== expense.id))
    setPendingLinks((prev) => prev.some((e) => e.id === expense.id) ? prev : [...prev, expense])
    setIsDirty(true)
  }, [])

  const handleUnlinkExpense = useCallback((expense: Expense) => {
    setPendingLinks((prev) => prev.filter((e) => e.id !== expense.id))
    setPendingUnlinks((prev) => [...prev, expense])
    setIsDirty(true)
  }, [])

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

    // Schedule conflict check
    if (!skipConflictCheck.current) {
      const selectedDates = formData.shootDates ? formData.shootDates.split(',').map((d) => d.trim()).filter(Boolean) : []
      const found: { date: string; jobNumber: string; clientName: string }[] = []
      selectedDates.forEach((d) => {
        const entries = bookedDateMap.get(d)
        if (entries) entries.forEach((e) => found.push({ date: d, ...e }))
      })
      if (found.length > 0) {
        setConflicts(found)
        setShowConflictModal(true)
        return
      }
    }
    skipConflictCheck.current = false

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

    let savedJob: Job | undefined
    let savedItems: JobItem[] = []

    if (isNew) {
      const job = await createJob({
        ...formData,
        title: '',
        taxRate: formData.taxRate,
        paymentWindow: parseInt(formData.paymentWindow) || 30,
      }, settings)
      if (job) {
        savedItems = await setJobItems(spreadsheetId, job.id, job.jobNumber, fullItems.map((item) => ({
          ...item,
          jobId: job.id,
          jobNumber: job.jobNumber,
        })), token)
        savedJob = job
      }
    } else if (existingJob) {
      const updatedJob: Job = { ...existingJob, ...formData, title: existingJob.title, taxRate: formData.taxRate, paymentWindow: parseInt(formData.paymentWindow) || 30 }
      await updateJob(updatedJob)
      savedItems = await setJobItems(spreadsheetId, existingJob.id, existingJob.jobNumber, fullItems.map((item) => ({
        ...item,
        jobId: existingJob.id,
        jobNumber: existingJob.jobNumber,
      })), token)
      savedJob = updatedJob
    }

    if (savedJob) {
      // Persist expense link/unlink operations
      await Promise.all([
        ...pendingLinks.map((expense) =>
          updateExpense({ ...expense, jobId: savedJob!.id, billed: true })
        ),
        ...pendingUnlinks.map((expense) =>
          updateExpense({ ...expense, jobId: '', billed: false })
        ),
      ])
      setPendingLinks([])
      setPendingUnlinks([])
      // Update items in context so JobCard/totals reflect the saved line items
      setAllItems((prev) => [
        ...prev.filter((item) => item.jobId !== savedJob!.id),
        ...savedItems,
      ])
    }

    return savedJob
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await saveJob()
      if (saved) {
        setIsDirty(false)
        showToast(isNew ? `Job #${saved.jobNumber} created` : `Job #${saved.jobNumber} saved`)
        navigate('/', { replace: true })
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
        <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center text-xl">
          ←
        </button>
        <h1 className="text-2xl font-bold">{isNew ? 'New Job' : `Job #${existingJob?.jobNumber}`}</h1>
      </div>

      <div className="space-y-6">
        <JobForm
          data={formData}
          onChange={handleFormChange}
          clients={clients}
          contacts={contacts}
          bookedDates={bookedDates}
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
            onChange={handleItemsChange}
            laborRates={labor}
            equipmentRates={equipment}
            settings={settings}
            shootDays={shootDays || 1}
            readOnly={lineItemsReadOnly}
            onCreateRate={handleCreateRate}
            clientId={formData.clientId}
            linkedExpenses={linkedExpenses}
            availableExpenses={availableExpenses}
            onLinkExpense={handleLinkExpense}
            onUnlinkExpense={handleUnlinkExpense}
          />
        </div>

        <JobSummary items={items} taxRate={formData.taxRate} shootDays={shootDays || 1} expensesSubtotal={expensesSubtotal} />

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-white rounded-lg py-3 font-medium min-h-[44px] hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? 'Saving...' : isNew ? 'Create Job' : 'Save Job'}
        </button>
      </div>

      <Modal open={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Unsaved Changes">
        <p className="text-gray-600 mb-4">You have unsaved changes. Are you sure you want to leave?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLeaveModal(false)}
            className="flex-1 bg-primary text-white rounded-lg py-2 font-medium min-h-[44px] hover:bg-primary-dark"
          >
            Stay
          </button>
          <button
            onClick={() => { setIsDirty(false); setShowLeaveModal(false); navigate('/') }}
            className="flex-1 bg-gray-200 text-gray-700 rounded-lg py-2 font-medium min-h-[44px] hover:bg-gray-300"
          >
            Leave
          </button>
        </div>
      </Modal>

      <Modal open={showConflictModal} onClose={() => setShowConflictModal(false)} title="Schedule Conflict">
        <p className="text-gray-600 mb-3">The following dates overlap with existing jobs:</p>
        <ul className="space-y-1 mb-4">
          {conflicts.map((c, i) => (
            <li key={i} className="text-sm text-gray-700">
              <span className="font-medium">{formatDateDisplay(c.date)}</span> — Job #{c.jobNumber} ({c.clientName})
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConflictModal(false)}
            className="flex-1 bg-gray-200 text-gray-700 rounded-lg py-2 font-medium min-h-[44px] hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => { setShowConflictModal(false); skipConflictCheck.current = true; handleSave() }}
            className="flex-1 bg-primary text-white rounded-lg py-2 font-medium min-h-[44px] hover:bg-primary-dark"
          >
            Save Anyway
          </button>
        </div>
      </Modal>
    </div>
  )
}
