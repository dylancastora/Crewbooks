import { jsPDF } from 'jspdf'
import type { Job, JobItem, Expense, Client, Settings, JobTotals } from '../types'

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function generateJobPDF(
  job: Job,
  items: JobItem[],
  expenses: Expense[],
  client: Client,
  settings: Settings,
  totals: JobTotals,
): Uint8Array {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  // Business header
  doc.setFontSize(18)
  doc.setTextColor(30, 64, 175) // primary color
  doc.text(settings.businessName || 'CrewBooks', 14, y)
  y += 8

  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  if (settings.businessAddress) { doc.text(settings.businessAddress, 14, y); y += 4 }
  if (settings.businessPhone) { doc.text(settings.businessPhone, 14, y); y += 4 }
  if (settings.businessEmail) { doc.text(settings.businessEmail, 14, y); y += 4 }
  y += 6

  // Invoice title
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  const isInvoice = job.status === 'invoiced' || job.status === 'paid'
  doc.text(isInvoice ? `Invoice #${job.jobNumber}` : `Quote #${job.jobNumber}`, 14, y)
  y += 8

  // Client info
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text('Bill To:', 14, y); y += 5
  doc.setTextColor(0, 0, 0)
  doc.text(client.company, 14, y); y += 5
  if (client.address) { doc.text(client.address, 14, y); y += 5 }
  if (client.city || client.state || client.zip) {
    doc.text([client.city, client.state, client.zip].filter(Boolean).join(', '), 14, y); y += 5
  }
  y += 3

  // Dates
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  if (job.shootDates) { doc.text(`Shoot Dates: ${job.shootDates}`, 14, y); y += 5 }
  if (job.paymentTerms) { doc.text(`Payment Terms: ${job.paymentTerms}`, 14, y); y += 5 }
  y += 5

  // Line items table header
  doc.setFillColor(243, 244, 246)
  doc.rect(14, y - 3, pageWidth - 28, 8, 'F')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text('Description', 16, y + 2)
  doc.text('Date', 90, y + 2)
  doc.text('Qty', 115, y + 2)
  doc.text('Rate', 135, y + 2)
  doc.text('Amount', 160, y + 2)
  y += 10

  // Group items by type
  const grouped = new Map<string, JobItem[]>()
  for (const item of items) {
    if (!grouped.has(item.type)) grouped.set(item.type, [])
    grouped.get(item.type)!.push(item)
  }

  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)

  for (const [type, typeItems] of grouped) {
    // Type header
    doc.setFontSize(9)
    doc.setTextColor(30, 64, 175)
    doc.text(type.charAt(0).toUpperCase() + type.slice(1), 16, y)
    y += 5

    doc.setTextColor(0, 0, 0)
    for (const item of typeItems) {
      if (y > 270) { doc.addPage(); y = 20 }
      const amount = item.quantity * item.rate
      doc.text(item.description.substring(0, 40), 16, y)
      doc.text(item.date || '', 90, y)
      doc.text(String(item.quantity), 115, y)
      doc.text(formatCurrency(item.rate), 135, y)
      doc.text(formatCurrency(amount), 160, y)
      y += 5
    }
    y += 3
  }

  // Expenses
  if (expenses.length > 0) {
    if (y > 250) { doc.addPage(); y = 20 }
    doc.setFontSize(9)
    doc.setTextColor(30, 64, 175)
    doc.text('Reimbursable Expenses', 16, y)
    y += 5
    doc.setTextColor(0, 0, 0)
    for (const expense of expenses) {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(expense.description.substring(0, 50), 16, y)
      doc.text(expense.date || '', 90, y)
      doc.text(formatCurrency(expense.amount), 160, y)
      y += 5
    }
    y += 3
  }

  // Totals
  if (y > 250) { doc.addPage(); y = 20 }
  const totalsX = 120
  doc.setDrawColor(200, 200, 200)
  doc.line(totalsX, y, pageWidth - 14, y)
  y += 5

  doc.setFontSize(9)
  if (totals.laborSubtotal > 0) { doc.text('Labor:', totalsX, y); doc.text(formatCurrency(totals.laborSubtotal), 160, y); y += 5 }
  if (totals.equipmentSubtotal > 0) { doc.text('Equipment:', totalsX, y); doc.text(formatCurrency(totals.equipmentSubtotal), 160, y); y += 5 }
  if (totals.mileageSubtotal > 0) { doc.text('Mileage:', totalsX, y); doc.text(formatCurrency(totals.mileageSubtotal), 160, y); y += 5 }
  if (totals.expensesSubtotal > 0) { doc.text('Expenses:', totalsX, y); doc.text(formatCurrency(totals.expensesSubtotal), 160, y); y += 5 }
  if (totals.taxAmount > 0) { doc.text(`Tax (${job.taxRate}%):`, totalsX, y); doc.text(formatCurrency(totals.taxAmount), 160, y); y += 5 }

  doc.setDrawColor(0, 0, 0)
  doc.line(totalsX, y, pageWidth - 14, y)
  y += 6
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total:', totalsX, y)
  doc.text(formatCurrency(totals.total), 160, y)

  // Notes
  if (job.notes) {
    y += 15
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Notes: ${job.notes}`, 14, y, { maxWidth: pageWidth - 28 })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}
