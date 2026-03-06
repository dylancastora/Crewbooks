export const JobStatus = {
  Draft: 'draft',
  Quoted: 'quoted',
  Approved: 'approved',
  Invoiced: 'invoiced',
  Paid: 'paid',
} as const
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus]

export const ItemType = {
  Labor: 'labor',
  Equipment: 'equipment',
  Mileage: 'mileage',
  Custom: 'custom',
} as const
export type ItemType = (typeof ItemType)[keyof typeof ItemType]

export const ExpenseCategory = {
  Fuel: 'Fuel',
  Meals: 'Meals',
  Equipment: 'Equipment',
  Supplies: 'Supplies',
  Rentals: 'Rentals',
  Parking: 'Parking',
  Other: 'Other',
} as const
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory]

export const Unit = {
  Hour: 'hour',
  Day: 'day',
  Week: 'week',
  Flat: 'flat',
} as const
export type Unit = (typeof Unit)[keyof typeof Unit]

export interface Client {
  id: string
  company: string
  address: string
  city: string
  state: string
  zip: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  clientId: string
  name: string
  email: string
  phone: string
  role: string
  createdAt: string
  updatedAt: string
}

export interface LaborRate {
  id: string
  name: string
  rate: number
  unit: Unit
  taxable: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EquipmentRate {
  id: string
  name: string
  rate: number
  unit: Unit
  taxable: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Job {
  id: string
  jobNumber: string
  clientId: string
  title: string
  status: JobStatus
  contactIds: string
  shootDates: string
  taxRate: number
  paymentTerms: string
  notes: string
  cancelled: boolean
  createdAt: string
  updatedAt: string
}

export interface JobItem {
  id: string
  jobId: string
  jobNumber: string
  type: ItemType
  description: string
  date: string
  quantity: number
  rate: number
  taxable: boolean
  sortOrder: number
  amount: number
}

export type CommunicationType = 'quote' | 'invoice'

export interface Communication {
  id: string
  jobId: string
  type: CommunicationType
  dateSent: string
  recipients: string
  amount: number
  subject: string
  notes: string
  isResend: boolean
  priorCommunicationId: string
}

export interface JobTotals {
  laborSubtotal: number
  equipmentSubtotal: number
  mileageSubtotal: number
  customSubtotal: number
  expensesSubtotal: number
  taxableSubtotal: number
  taxAmount: number
  total: number
}

export interface Expense {
  id: string
  jobId: string
  clientId: string
  description: string
  amount: number
  date: string
  category: ExpenseCategory
  receiptFileId: string
  receiptFileName: string
  billed: boolean
  createdAt: string
  updatedAt: string
}

export interface Settings {
  [key: string]: string
}

export interface UserInfo {
  name: string
  email: string
  picture: string
}

export interface Workspace {
  spreadsheetId: string
  rootFolderId: string
  receiptsFolderId: string
}
