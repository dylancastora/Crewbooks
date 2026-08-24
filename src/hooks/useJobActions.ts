import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useJobs } from './useJobs'
import { useClients } from './useClients'
import { useSettings } from './useSettings'
import { useCommunications } from './useCommunications'
import { useJobItems } from './useJobItems'
import { useExpenses } from './useExpenses'
import { useJobTotals } from './useJobTotals'
import { calculateTotals } from '../services/api/jobs'
import { getExpensesForJob } from '../services/api/expenses'
import { sendEmail } from '../services/google/gmail'
import { downloadFile } from '../services/google/drive'
import { generateQuoteHtml, generateInvoiceHtml } from '../templates/email'
import { generateJobPDF } from '../templates/pdf'
import { JobStatus } from '../types'
import type { Job, JobTotals, Communication, CommunicationType, Contact } from '../types'

interface PreferredAction {
  label: string
  handler: () => Promise<void>
  colorClass: string
}

interface MenuAction {
  label: string
  handler: () => Promise<void>
  isDanger?: boolean
  confirmMessage?: string
}

interface Attachment {
  filename: string
  mimeType: string
  data: Uint8Array
}

/**
 * Send one email per contact, each with its own body, and report who actually
 * received it. A job's contacts are a hand-picked subset of the client's
 * people, so every one of them is addressed by name rather than sharing a
 * single message headed with whoever happened to be first.
 */
async function sendToEachContact(
  token: string,
  recipients: Contact[],
  build: (contact: Contact) => { subject: string; html: string; attachments?: Attachment[] },
): Promise<{ delivered: string[]; failed: string[] }> {
  const results = await Promise.allSettled(
    recipients.map((contact) => sendEmail(token, { to: [contact.email], ...build(contact) })),
  )

  const delivered: string[] = []
  const failed: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') delivered.push(recipients[i].email)
    else failed.push(recipients[i].email)
  })
  return { delivered, failed }
}

export function useJobActions(onComplete?: () => void) {
  const { spreadsheetId, getToken } = useAuth()
  const { jobs, updateJob, deleteJob: deleteJobFromHook } = useJobs()
  const { clients, contacts } = useClients()
  const { settings } = useSettings()
  const { getForJob, createCommunication } = useCommunications()
  const { allItems, getItemsForJob } = useJobItems()
  const { expenses: allExpenses } = useExpenses()
  const totalsMap = useJobTotals(allItems, jobs, allExpenses)

  const getTotalsForJob = useCallback((job: Job): JobTotals => {
    return totalsMap.get(job.id) || { laborSubtotal: 0, equipmentSubtotal: 0, mileageSubtotal: 0, customSubtotal: 0, expensesSubtotal: 0, taxableSubtotal: 0, taxAmount: 0, total: 0 }
  }, [totalsMap])

  /** Contacts in the order they were picked on the job — the first is primary. */
  const getJobContacts = useCallback((job: Job): Contact[] => {
    return job.contactIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => contacts.find((c) => c.id === id))
      .filter((c): c is Contact => !!c)
  }, [contacts])

  /** Already-sent quotes/invoices of one type, oldest last. */
  const getPriorComms = useCallback((jobId: string, type: CommunicationType): Communication[] => {
    return getForJob(jobId)
      .filter((c) => c.type === type)
      .sort((a, b) => a.dateSent.localeCompare(b.dateSent))
  }, [getForJob])

  const sendQuote = useCallback(async (job: Job) => {
    if (!spreadsheetId) return
    const token = await getToken()
    const jobItems = getItemsForJob(job.id)
    const jobExpenses = await getExpensesForJob(spreadsheetId, job.id, token)
    const totals = calculateTotals(jobItems, jobExpenses, job.taxRate)

    if (totals.total === 0) {
      throw new Error('Cannot send quote: job has no line items')
    }

    const client = clients.find((c) => c.id === job.clientId)
    const recipients = getJobContacts(job).filter((c) => c.email)

    if (!client || recipients.length === 0) {
      throw new Error('Cannot send quote: missing client or contact emails')
    }

    const subject = `Quote #${job.jobNumber} - ${client.company}`

    // One email per contact so each is greeted by name; they all carry the same
    // client-level Bill To block and the same figures.
    const { delivered, failed } = await sendToEachContact(token, recipients, (contact) => ({
      subject,
      html: generateQuoteHtml(job, jobItems, jobExpenses, client, contact, settings, totals),
    }))

    if (delivered.length === 0) {
      throw new Error(`Cannot send quote: delivery failed for ${failed.join(', ')}`)
    }

    const priorComms = getPriorComms(job.id, 'quote')
    const actualIsResend = priorComms.length > 0
    await createCommunication({
      jobId: job.id,
      type: 'quote',
      dateSent: new Date().toISOString(),
      recipients: delivered.join(', '),
      amount: totals.total,
      subject,
      notes: '',
      isResend: actualIsResend,
      priorCommunicationId: actualIsResend ? priorComms[priorComms.length - 1].id : '',
    })

    const updated = { ...job, status: JobStatus.Quoted, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [spreadsheetId, getToken, getItemsForJob, clients, settings, getJobContacts, getPriorComms, createCommunication, updateJob, onComplete])

  const sendInvoice = useCallback(async (job: Job) => {
    if (!spreadsheetId) return
    const token = await getToken()
    const jobItems = getItemsForJob(job.id)
    const jobExpenses = await getExpensesForJob(spreadsheetId, job.id, token)
    const totals = calculateTotals(jobItems, jobExpenses, job.taxRate)

    if (totals.total === 0) {
      throw new Error('Cannot send invoice: job has no line items')
    }

    const client = clients.find((c) => c.id === job.clientId)
    const recipients = getJobContacts(job).filter((c) => c.email)

    if (!client || recipients.length === 0) {
      throw new Error('Cannot send invoice: missing client or contact emails')
    }

    const subject = `Invoice #${job.jobNumber} - ${client.company}`
    const invoiceDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const pdfData = generateJobPDF(job, jobItems, jobExpenses, client, settings, totals, invoiceDate)

    const attachments: Attachment[] = [
      { filename: `Invoice-${job.jobNumber}.pdf`, mimeType: 'application/pdf', data: pdfData },
    ]

    for (const expense of jobExpenses) {
      if (expense.receiptFileId) {
        try {
          const file = await downloadFile(expense.receiptFileId, token)
          attachments.push({ filename: file.name, mimeType: file.mimeType, data: file.data })
        } catch {
          console.warn(`Failed to download receipt ${expense.receiptFileId}`)
        }
      }
    }

    // One email per contact so each is greeted by name; they all carry the same
    // client-level Bill To block, figures, and attachments.
    const { delivered, failed } = await sendToEachContact(token, recipients, (contact) => ({
      subject,
      html: generateInvoiceHtml(job, jobItems, jobExpenses, client, contact, settings, totals),
      attachments,
    }))

    if (delivered.length === 0) {
      throw new Error(`Cannot send invoice: delivery failed for ${failed.join(', ')}`)
    }

    const priorComms = getPriorComms(job.id, 'invoice')
    const actualIsResend = priorComms.length > 0
    await createCommunication({
      jobId: job.id,
      type: 'invoice',
      dateSent: new Date().toISOString(),
      recipients: delivered.join(', '),
      amount: totals.total,
      subject,
      notes: '',
      isResend: actualIsResend,
      priorCommunicationId: actualIsResend ? priorComms[priorComms.length - 1].id : '',
    })

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (job.paymentWindow || 30))
    const dueDateStr = dueDate.toISOString().split('T')[0]
    const updated = { ...job, status: JobStatus.Invoiced, dueDate: dueDateStr, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [spreadsheetId, getToken, getItemsForJob, clients, settings, getJobContacts, getPriorComms, createCommunication, updateJob, onComplete])

  const approveQuote = useCallback(async (job: Job) => {
    const updated = { ...job, status: JobStatus.Approved, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [updateJob, onComplete])

  const revokeApproval = useCallback(async (job: Job) => {
    const updated = { ...job, status: JobStatus.Quoted, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [updateJob, onComplete])

  const markPaid = useCallback(async (job: Job) => {
    const updated = { ...job, status: JobStatus.Paid, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [updateJob, onComplete])

  const markUnpaid = useCallback(async (job: Job) => {
    const updated = { ...job, status: JobStatus.Invoiced, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [updateJob, onComplete])

  const cancelJob = useCallback(async (job: Job) => {
    const updated = { ...job, cancelled: true, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [updateJob, onComplete])

  const uncancelJob = useCallback(async (job: Job) => {
    const updated = { ...job, cancelled: false, updatedAt: new Date().toISOString() }
    await updateJob(updated)
    onComplete?.()
  }, [updateJob, onComplete])

  const deleteJobAction = useCallback(async (job: Job) => {
    await deleteJobFromHook(job.id)
    onComplete?.()
  }, [deleteJobFromHook, onComplete])

  const getShootDateStatus = (job: Job): 'future' | 'today_or_past' => {
    if (!job.shootDates) return 'future'
    const today = new Date().toISOString().split('T')[0]
    const dates = job.shootDates.split(',').map((d) => d.trim()).filter(Boolean)
    const latestDate = dates.sort().pop() || ''
    return latestDate >= today ? 'future' : 'today_or_past'
  }

  const getPreferredAction = useCallback((job: Job): PreferredAction | null => {
    if (job.cancelled) return null

    switch (job.status) {
      case JobStatus.Draft:
        return { label: 'Send Quote', handler: () => sendQuote(job), colorClass: 'bg-blue-600 hover:bg-blue-700 text-white' }
      case JobStatus.Quoted:
        if (getShootDateStatus(job) === 'future') {
          return { label: 'Approve Quote', handler: () => approveQuote(job), colorClass: 'bg-green-600 hover:bg-green-700 text-white' }
        }
        return { label: 'Send Invoice', handler: () => sendInvoice(job), colorClass: 'bg-orange-600 hover:bg-orange-700 text-white' }
      case JobStatus.Approved:
        return { label: 'Send Invoice', handler: () => sendInvoice(job), colorClass: 'bg-orange-600 hover:bg-orange-700 text-white' }
      case JobStatus.Invoiced:
        return { label: 'Mark as Paid', handler: () => markPaid(job), colorClass: 'bg-emerald-600 hover:bg-emerald-700 text-white' }
      case JobStatus.Paid:
        return null
      default:
        return null
    }
  }, [sendQuote, approveQuote, sendInvoice, markPaid])

  const getMenuActions = useCallback((job: Job, onNavigateEdit?: () => void): MenuAction[] => {
    if (job.cancelled) {
      return [
        { label: 'Uncancel', handler: () => uncancelJob(job) },
        { label: 'Delete', handler: () => deleteJobAction(job), isDanger: true, confirmMessage: 'Delete this job, its line items and its communication history? Linked expenses are kept and returned to unbilled. This cannot be undone.' },
      ]
    }

    const actions: MenuAction[] = []

    // Edit action (with confirmation for certain statuses)
    if (onNavigateEdit) {
      if (job.status === JobStatus.Approved) {
        actions.push({ label: 'Edit', handler: async () => onNavigateEdit(), confirmMessage: 'This job is approved. Editing may require re-approval.' })
      } else if (job.status === JobStatus.Invoiced) {
        actions.push({ label: 'Edit', handler: async () => onNavigateEdit(), confirmMessage: 'This job has been invoiced. The invoice already sent stays as it is — resend it when you are done editing.' })
      } else if (job.status === JobStatus.Paid) {
        actions.push({ label: 'Edit', handler: async () => onNavigateEdit(), confirmMessage: 'This job is marked as paid. The invoice already sent stays as it is — mark it unpaid and resend if the client needs a corrected copy.' })
      } else {
        actions.push({ label: 'Edit', handler: async () => onNavigateEdit() })
      }
    }

    switch (job.status) {
      case JobStatus.Draft:
        actions.push(
          { label: 'Approve Quote', handler: () => approveQuote(job) },
          { label: 'Send Invoice', handler: () => sendInvoice(job) },
          { label: 'Mark as Paid', handler: () => markPaid(job) },
        )
        break
      case JobStatus.Quoted:
        if (getShootDateStatus(job) === 'future') {
          actions.push(
            { label: 'Resend Quote', handler: () => sendQuote(job) },
            { label: 'Send Invoice', handler: () => sendInvoice(job) },
            { label: 'Mark as Paid', handler: () => markPaid(job) },
          )
        } else {
          actions.push(
            { label: 'Approve Quote', handler: () => approveQuote(job) },
            { label: 'Mark as Paid', handler: () => markPaid(job) },
          )
        }
        break
      case JobStatus.Approved:
        actions.push(
          { label: 'Revoke Approval', handler: () => revokeApproval(job) },
          { label: 'Mark as Paid', handler: () => markPaid(job) },
        )
        break
      case JobStatus.Invoiced:
        actions.push(
          { label: 'Resend Invoice', handler: () => sendInvoice(job) },
        )
        break
      case JobStatus.Paid:
        actions.push(
          { label: 'Mark Unpaid', handler: () => markUnpaid(job) },
        )
        break
    }

    // Cancel and Delete always available for non-cancelled jobs
    actions.push(
      { label: 'Cancel', handler: () => cancelJob(job), isDanger: true, confirmMessage: 'Cancel this job?' },
      { label: 'Delete', handler: () => deleteJobAction(job), isDanger: true, confirmMessage: 'Delete this job, its line items and its communication history? Linked expenses are kept and returned to unbilled. This cannot be undone.' },
    )

    return actions
  }, [sendQuote, sendInvoice, approveQuote, revokeApproval, markPaid, markUnpaid, cancelJob, uncancelJob, deleteJobAction])

  return {
    sendQuote, sendInvoice, approveQuote, revokeApproval, markPaid, markUnpaid,
    cancelJob, uncancelJob, deleteJob: deleteJobAction,
    getPreferredAction, getMenuActions, getTotalsForJob, totalsMap,
    jobs, allItems, allExpenses, getItemsForJob, getForJob,
  }
}
