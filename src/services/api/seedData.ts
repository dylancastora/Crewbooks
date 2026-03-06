import { createClient, createContact } from './clients'
import { createRate } from './rates'
import { createExpense } from './expenses'
import { createJob } from './jobs'
import { getJobs } from './jobs'
import { getRows } from '../google/sheets'
import type { Settings } from '../../types'

function getDateFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function generateTestData(spreadsheetId: string, token: string): Promise<void> {
  // Get existing settings
  const { rows: settingsRows } = await getRows(spreadsheetId, 'Settings', token)
  const settings: Settings = {}
  for (const row of settingsRows) {
    if (row.key) settings[row.key] = row.value || ''
  }

  // Get existing jobs for job number generation
  const existingJobs = await getJobs(spreadsheetId, token)

  // 3 Clients
  const client1 = await createClient(spreadsheetId, {
    company: 'Acme Productions',
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    notes: '',
  }, token)

  const client2 = await createClient(spreadsheetId, {
    company: 'Bright Spark Media',
    address: '456 Oak Ave',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    notes: '',
  }, token)

  const client3 = await createClient(spreadsheetId, {
    company: 'Summit Creative',
    address: '789 Pine Rd',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    notes: '',
  }, token)

  // 6 Contacts (2 per client)
  const contact1a = await createContact(spreadsheetId, {
    clientId: client1.id,
    name: 'Sarah Johnson',
    email: 'sarah@acmeproductions.com',
    phone: '310-555-0101',
    role: 'Producer',
  }, token)

  const contact1b = await createContact(spreadsheetId, {
    clientId: client1.id,
    name: 'Dylan Castora',
    email: 'dylancastora@gmail.com',
    phone: '',
    role: '',
  }, token)

  const contact2a = await createContact(spreadsheetId, {
    clientId: client2.id,
    name: 'Mike Chen',
    email: 'mike@brightspark.com',
    phone: '212-555-0202',
    role: 'Director',
  }, token)

  const contact2b = await createContact(spreadsheetId, {
    clientId: client2.id,
    name: 'Dylan Castora',
    email: 'dylancastora@gmail.com',
    phone: '',
    role: '',
  }, token)

  const contact3a = await createContact(spreadsheetId, {
    clientId: client3.id,
    name: 'Lisa Park',
    email: 'lisa@summitcreative.com',
    phone: '312-555-0303',
    role: 'Production Manager',
  }, token)

  const contact3b = await createContact(spreadsheetId, {
    clientId: client3.id,
    name: 'Dylan Castora',
    email: 'dylancastora@gmail.com',
    phone: '',
    role: '',
  }, token)

  // Rates
  await createRate(spreadsheetId, 'Labor', {
    name: 'Sound Mixer',
    rate: 900,
    unit: 'day',
    taxable: false,
    isActive: true,
  }, token)

  await createRate(spreadsheetId, 'Equipment', {
    name: 'Sound Kit',
    rate: 450,
    unit: 'day',
    taxable: true,
    isActive: true,
  }, token)

  await createRate(spreadsheetId, 'Equipment', {
    name: 'Smart Slate',
    rate: 50,
    unit: 'day',
    taxable: true,
    isActive: true,
  }, token)

  await createRate(spreadsheetId, 'Equipment', {
    name: 'Extra Wireless Channel',
    rate: 100,
    unit: 'day',
    taxable: true,
    isActive: true,
  }, token)

  // 3 Expenses (assigned to first client, billed: false)
  await createExpense(spreadsheetId, {
    jobId: '',
    clientId: client1.id,
    description: 'Gas to set',
    amount: 45,
    date: getDateFromNow(-1),
    category: 'Fuel',
    receiptFileId: '',
    receiptFileName: '',
    billed: false,
  }, token)

  await createExpense(spreadsheetId, {
    jobId: '',
    clientId: client1.id,
    description: 'Lunch on set',
    amount: 32,
    date: getDateFromNow(-1),
    category: 'Meals',
    receiptFileId: '',
    receiptFileName: '',
    billed: false,
  }, token)

  await createExpense(spreadsheetId, {
    jobId: '',
    clientId: client1.id,
    description: 'Parking garage',
    amount: 25,
    date: getDateFromNow(-1),
    category: 'Parking',
    receiptFileId: '',
    receiptFileName: '',
    billed: false,
  }, token)

  // 3 Draft Jobs (one per client)
  const allJobsForNumbering = [...existingJobs]

  const job1 = await createJob(spreadsheetId, {
    clientId: client1.id,
    contactIds: [contact1a.id, contact1b.id].join(','),
    shootDates: [getDateFromNow(3), getDateFromNow(4)].join(','),
    paymentTerms: settings.defaultPaymentTerms || 'Net 30',
    notes: '',
    title: '',
    taxRate: 0,
  }, settings, allJobsForNumbering, token)
  allJobsForNumbering.push(job1)

  const job2 = await createJob(spreadsheetId, {
    clientId: client2.id,
    contactIds: [contact2a.id, contact2b.id].join(','),
    shootDates: getDateFromNow(5),
    paymentTerms: settings.defaultPaymentTerms || 'Net 30',
    notes: '',
    title: '',
    taxRate: 0,
  }, settings, allJobsForNumbering, token)
  allJobsForNumbering.push(job2)

  await createJob(spreadsheetId, {
    clientId: client3.id,
    contactIds: [contact3a.id, contact3b.id].join(','),
    shootDates: [getDateFromNow(7), getDateFromNow(8)].join(','),
    paymentTerms: settings.defaultPaymentTerms || 'Net 30',
    notes: '',
    title: '',
    taxRate: 0,
  }, settings, allJobsForNumbering, token)
}
