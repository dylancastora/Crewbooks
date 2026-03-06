import type { Job, JobItem, Expense, Client, Contact, Settings, JobTotals } from '../types'

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function itemRows(items: JobItem[]): string {
  return items
    .map((item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.date || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.rate)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>
    `)
    .join('')
}

function computeShootDays(shootDates: string): number {
  if (!shootDates) return 1
  return shootDates.split(',').map((d) => d.trim()).filter(Boolean).length || 1
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

  const expenseRows = expenses.length > 0
    ? `
      <h3 style="margin-top: 20px;">Reimbursable Expenses</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Description</th>
            <th style="padding: 8px; text-align: center;">Date</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((e) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${e.description}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${e.date}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(e.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : ''

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Quote #${job.jobNumber}</h2>
      <p>Hi ${recipientName},</p>
      <p>Please find the quote details below for <strong>${job.title || `Job #${job.jobNumber}`}</strong>.</p>
      ${job.shootDates ? `<p><strong>Shoot Dates:</strong> ${job.shootDates}</p>` : ''}

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Description</th>
            <th style="padding: 8px; text-align: center;">Date</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Rate</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows(items)}</tbody>
      </table>

      ${expenseRows}

      <table style="width: 300px; margin-left: auto;">
        <tr><td style="padding: 4px;">Subtotal</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.total - totals.taxAmount)}</td></tr>
        ${computeShootDays(job.shootDates) > 1 ? `
          <tr><td style="padding: 4px; color: #666;">Shoot Days</td><td style="text-align: right; padding: 4px; color: #666;">${computeShootDays(job.shootDates)} days</td></tr>
        ` : ''}
        ${totals.taxAmount > 0 ? `
          <tr><td style="padding: 4px;">Tax (${job.taxRate}%)</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.taxAmount)}</td></tr>
        ` : ''}
        <tr style="font-weight: bold; font-size: 1.1em;">
          <td style="padding: 8px 4px; border-top: 2px solid #333;">Total</td>
          <td style="text-align: right; padding: 8px 4px; border-top: 2px solid #333;">${formatCurrency(totals.total)}</td>
        </tr>
      </table>

      ${job.notes ? `<p style="margin-top: 20px; color: #666;"><strong>Notes:</strong> ${job.notes}</p>` : ''}

      <p style="margin-top: 30px;">
        Best regards,<br/>
        ${settings.businessName || ''}<br/>
        ${settings.businessPhone ? settings.businessPhone + '<br/>' : ''}
        ${settings.businessEmail || ''}
      </p>
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

  const expenseRows = expenses.length > 0
    ? `
      <h3 style="margin-top: 20px;">Reimbursable Expenses</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Description</th>
            <th style="padding: 8px; text-align: center;">Date</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((e) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${e.description}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${e.date}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(e.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : ''

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e40af;">Invoice #${job.jobNumber}</h2>
      <p>Hi ${recipientName},</p>
      <p>Please find the invoice details below for <strong>${job.title || `Job #${job.jobNumber}`}</strong>.</p>
      ${job.shootDates ? `<p><strong>Shoot Dates:</strong> ${job.shootDates}</p>` : ''}

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Description</th>
            <th style="padding: 8px; text-align: center;">Date</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Rate</th>
            <th style="padding: 8px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows(items)}</tbody>
      </table>

      ${expenseRows}

      <table style="width: 250px; margin-left: auto; margin-top: 20px;">
        ${totals.laborSubtotal > 0 ? `<tr><td style="padding: 4px;">Labor</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.laborSubtotal)}</td></tr>` : ''}
        ${totals.equipmentSubtotal > 0 ? `<tr><td style="padding: 4px;">Equipment</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.equipmentSubtotal)}</td></tr>` : ''}
        ${totals.mileageSubtotal > 0 ? `<tr><td style="padding: 4px;">Mileage</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.mileageSubtotal)}</td></tr>` : ''}
        ${totals.expensesSubtotal > 0 ? `<tr><td style="padding: 4px;">Expenses</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.expensesSubtotal)}</td></tr>` : ''}
        ${totals.taxAmount > 0 ? `<tr><td style="padding: 4px;">Tax (${job.taxRate}%)</td><td style="text-align: right; padding: 4px;">${formatCurrency(totals.taxAmount)}</td></tr>` : ''}
        <tr style="font-weight: bold; font-size: 1.1em;">
          <td style="padding: 8px 4px; border-top: 2px solid #333;">Total Due</td>
          <td style="text-align: right; padding: 8px 4px; border-top: 2px solid #333;">${formatCurrency(totals.total)}</td>
        </tr>
      </table>

      <p style="margin-top: 20px;"><strong>Payment Terms:</strong> ${job.paymentTerms}</p>
      ${job.notes ? `<p style="color: #666;"><strong>Notes:</strong> ${job.notes}</p>` : ''}

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
      <p style="color: #888; font-size: 0.9em;">
        ${settings.businessName || ''}<br/>
        ${settings.businessAddress ? settings.businessAddress + '<br/>' : ''}
        ${settings.businessPhone ? settings.businessPhone + '<br/>' : ''}
        ${settings.businessEmail || ''}
      </p>
    </div>
  `
}
