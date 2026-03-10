import type { Job, JobItem, Expense, Client, Contact, Settings, JobTotals } from '../types'
import { escapeHtml } from '../utils/sanitize'

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function computeShootDays(shootDates: string): number {
  if (!shootDates) return 1
  return shootDates.split(',').map((d) => d.trim()).filter(Boolean).length || 1
}

function buildLineItemsHtml(job: Job, items: JobItem[], expenses: Expense[], totals: JobTotals): string {
  const shootDays = computeShootDays(job.shootDates)
  const dailyItems = items.filter((i) => i.type === 'labor' || i.type === 'equipment')
  const mileageItems = items.filter((i) => i.type === 'mileage')

  let html = ''

  // Daily Rates section (Labor + Equipment)
  if (dailyItems.length > 0) {
    html += `
      <h3 style="margin: 20px 0 8px; font-size: 14px; color: #333;">Daily Rates</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Description</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Rate</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${dailyItems.map((item) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.description)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${escapeHtml(String(item.quantity))}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.rate)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.quantity * item.rate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `

    const dailySubtotal = dailyItems.reduce((sum, i) => sum + i.quantity * i.rate, 0)
    html += `
      <table style="width: 250px; margin-left: auto;">
        <tr><td style="padding: 4px;">Daily Subtotal</td><td style="text-align: right; padding: 4px;">${formatCurrency(dailySubtotal)}</td></tr>
        ${shootDays > 1 ? `<tr><td style="padding: 4px; color: #666;">&times; ${escapeHtml(String(shootDays))} days</td><td style="text-align: right; padding: 4px; color: #666;">${formatCurrency(dailySubtotal * shootDays)}</td></tr>` : ''}
      </table>
    `
  }

  // Mileage & Expenses section
  if (mileageItems.length > 0 || expenses.length > 0) {
    html += `
      <h3 style="margin: 20px 0 8px; font-size: 14px; color: #333;">Mileage &amp; Expenses</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Description</th>
            <th style="padding: 8px; text-align: center;">Date</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${mileageItems.map((item) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.description)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;"></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.amount)}</td>
            </tr>
          `).join('')}
          ${expenses.map((e) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(e.description)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${escapeHtml(e.date)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(e.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }

  // Total calculation
  html += `
    <table style="width: 250px; margin-left: auto; margin-top: 20px;">
      ${totals.laborSubtotal > 0 ? `<tr><td style="padding: 4px;">Labor</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.laborSubtotal)}</td></tr>` : ''}
      ${totals.equipmentSubtotal > 0 ? `<tr><td style="padding: 4px;">Gear</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.equipmentSubtotal)}</td></tr>` : ''}
      ${totals.mileageSubtotal > 0 ? `<tr><td style="padding: 4px;">Mileage</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.mileageSubtotal)}</td></tr>` : ''}
      ${totals.expensesSubtotal > 0 ? `<tr><td style="padding: 4px;">Expenses</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.expensesSubtotal)}</td></tr>` : ''}
      ${totals.taxAmount > 0 ? `<tr><td style="padding: 4px;">Tax (${escapeHtml(String(job.taxRate))}%)</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.taxAmount)}</td></tr>` : ''}
      <tr style="font-weight: bold; font-size: 1.1em;">
        <td style="padding: 8px 4px; border-top: 2px solid #333;">Total</td>
        <td style="text-align: right; padding: 8px 4px; border-top: 2px solid #333;">${formatCurrency(totals.total)}</td>
      </tr>
    </table>
  `

  return html
}

export function generateQuoteHtml(
  job: Job,
  items: JobItem[],
  expenses: Expense[],
  client: Client,
  contacts: Contact[],
  settings: Settings,
  totals: JobTotals,
): string {
  const recipientName = contacts[0]?.name || client.company

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Quote #${escapeHtml(job.jobNumber)}</h2>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p>Please find the quote details below for <strong>${escapeHtml(job.title || `Job #${job.jobNumber}`)}</strong>.</p>
      ${job.shootDates ? `<p><strong>Shoot Dates:</strong> ${escapeHtml(job.shootDates)}</p>` : ''}

      ${buildLineItemsHtml(job, items, expenses, totals)}

      ${job.notes ? `<p style="margin-top: 20px; color: #666;"><strong>Notes:</strong> ${escapeHtml(job.notes)}</p>` : ''}

      <p style="margin-top: 30px;">
        Best regards,<br/>
        ${escapeHtml(settings.businessName || '')}<br/>
        ${settings.businessPhone ? escapeHtml(settings.businessPhone) + '<br/>' : ''}
        ${escapeHtml(settings.businessEmail || '')}
      </p>
      <p style="margin-top: 40px; color: #000; text-align: center;">Powered by <a href="https://crewbooks.io" style="color: #1e40af;">Crewbooks</a></p>
    </div>
  `
}

export function generateInvoiceHtml(
  job: Job,
  items: JobItem[],
  expenses: Expense[],
  client: Client,
  contacts: Contact[],
  settings: Settings,
  totals: JobTotals,
): string {
  const recipientName = contacts[0]?.name || client.company

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Invoice #${escapeHtml(job.jobNumber)}</h2>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p>Please find the invoice details below for <strong>${escapeHtml(job.title || `Job #${job.jobNumber}`)}</strong>.</p>
      ${job.shootDates ? `<p><strong>Shoot Dates:</strong> ${escapeHtml(job.shootDates)}</p>` : ''}

      ${buildLineItemsHtml(job, items, expenses, totals)}

      <p style="margin-top: 20px;"><strong>Payment Terms:</strong> ${escapeHtml(job.paymentTerms)}</p>
      ${(() => {
        const due = new Date()
        due.setDate(due.getDate() + (job.paymentWindow || 30))
        return `<p><strong>Due Date:</strong> ${due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`
      })()}
      ${job.notes ? `<p style="color: #666;"><strong>Notes:</strong> ${escapeHtml(job.notes)}</p>` : ''}

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
      <p style="color: #888; font-size: 0.9em;">
        ${escapeHtml(settings.businessName || '')}<br/>
        ${settings.businessAddress ? escapeHtml(settings.businessAddress) + '<br/>' : ''}
        ${settings.businessPhone ? escapeHtml(settings.businessPhone) + '<br/>' : ''}
        ${escapeHtml(settings.businessEmail || '')}
      </p>
      <p style="margin-top: 40px; color: #000; text-align: center;">Powered by <a href="https://crewbooks.io" style="color: #1e40af;">Crewbooks</a></p>
    </div>
  `
}
