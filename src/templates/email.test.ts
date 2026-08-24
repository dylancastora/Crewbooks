import { describe, it, expect } from 'vitest'
import { generateQuoteHtml, generateInvoiceHtml } from './email'
import type { Client, Contact, Job, JobItem, JobTotals, Settings } from '../types'

const client: Client = {
  id: 'client-1',
  company: 'Northwind Studios',
  address: '400 Mission St',
  city: 'San Francisco',
  state: 'CA',
  zip: '94105',
  notes: '',
  createdAt: '',
  updatedAt: '',
}

function makeContact(name: string): Contact {
  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    name,
    email: `${name.toLowerCase()}@example.com`,
    phone: '',
    role: '',
    createdAt: '',
    updatedAt: '',
  }
}

const job: Job = {
  id: 'job-1',
  jobNumber: '0042',
  clientId: client.id,
  title: '',
  status: 'draft',
  contactIds: '',
  shootDates: '2026-04-01',
  taxRate: 0,
  paymentTerms: 'Net 30',
  paymentWindow: 30,
  dueDate: '',
  notes: '',
  cancelled: false,
  createdAt: '',
  updatedAt: '',
}

const items: JobItem[] = [{
  id: 'item-1',
  jobId: job.id,
  jobNumber: job.jobNumber,
  type: 'labor',
  description: 'Director of Photography',
  days: 1,
  quantity: 1,
  rate: 1200,
  taxable: false,
  sortOrder: 0,
  amount: 1200,
}]

const totals: JobTotals = {
  laborSubtotal: 1200,
  equipmentSubtotal: 0,
  mileageSubtotal: 0,
  customSubtotal: 0,
  expensesSubtotal: 0,
  taxableSubtotal: 0,
  taxAmount: 0,
  total: 1200,
}

const settings: Settings = { businessName: 'Acme Films' }

const generators = [
  { label: 'quote', generate: generateQuoteHtml },
  { label: 'invoice', generate: generateInvoiceHtml },
]

describe.each(generators)('$label email', ({ generate }) => {
  it('greets the recipient by their own name', () => {
    const html = generate(job, items, [], client, makeContact('Dana'), settings, totals)
    expect(html).toContain('Hi Dana,')
  })

  // A job's contacts are a subset of the client's people; each gets their own
  // copy addressed to them, but the billing block is the client's, not theirs.
  it('gives each contact their own greeting and the same Bill To block', () => {
    const bodies = [makeContact('Dana'), makeContact('Sam')].map((contact) =>
      generate(job, items, [], client, contact, settings, totals),
    )

    expect(bodies[0]).toContain('Hi Dana,')
    expect(bodies[0]).not.toContain('Hi Sam,')
    expect(bodies[1]).toContain('Hi Sam,')
    expect(bodies[1]).not.toContain('Hi Dana,')

    const billTo = (html: string) => html.slice(html.indexOf('Bill To:'), html.indexOf('Shoot Dates'))
    expect(billTo(bodies[0])).toBe(billTo(bodies[1]))
    expect(billTo(bodies[0])).toContain('Northwind Studios')
  })

  it('falls back to the company when there is no contact', () => {
    const html = generate(job, items, [], client, null, settings, totals)
    expect(html).toContain('Hi Northwind Studios,')
  })

  it('carries the same Bill To block the invoice PDF uses', () => {
    const html = generate(job, items, [], client, makeContact('Dana'), settings, totals)
    expect(html).toContain('Bill To:')
    expect(html).toContain('Northwind Studios')
    expect(html).toContain('400 Mission St')
    expect(html).toContain('San Francisco, CA, 94105')
  })

  it('omits blank address lines from the Bill To block', () => {
    const sparse: Client = { ...client, address: '', city: '', state: '', zip: '' }
    const html = generate(job, items, [], sparse, makeContact('Dana'), settings, totals)
    expect(html).toContain('Bill To:')
    expect(html).not.toContain('<p style="margin: 0; color: #000;"></p>')
  })

  it('escapes contact and client values', () => {
    const nasty: Client = { ...client, company: '<script>alert(1)</script>' }
    const html = generate(job, items, [], nasty, null, settings, totals)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
