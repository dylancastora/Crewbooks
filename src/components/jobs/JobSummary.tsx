import { Card } from '../ui/Card'
import type { JobItem } from '../../types'

interface JobSummaryProps {
  items: Array<Omit<JobItem, 'id' | 'jobId' | 'jobNumber' | 'sortOrder' | 'amount'>>
  taxRate: number
  shootDays: number
  expensesSubtotal?: number
}

export function JobSummary({ items, taxRate, shootDays, expensesSubtotal = 0 }: JobSummaryProps) {
  // Daily subtotals (without day multiplication)
  let laborDaily = 0
  let equipmentDaily = 0
  let mileageSubtotal = 0
  let customDaily = 0
  let taxableSubtotal = 0

  for (const item of items) {
    const dailyAmount = item.quantity * item.rate
    const fullAmount = item.type === 'mileage' ? dailyAmount : shootDays * dailyAmount
    switch (item.type) {
      case 'labor': laborDaily += dailyAmount; break
      case 'equipment': equipmentDaily += dailyAmount; break
      case 'mileage': mileageSubtotal += dailyAmount; break
      default: customDaily += dailyAmount; break
    }
    if (item.taxable) taxableSubtotal += fullAmount
  }

  const dailySubtotal = laborDaily + equipmentDaily + customDaily
  const dayMultipliedSubtotal = dailySubtotal * shootDays + mileageSubtotal
  const taxAmount = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100
  const total = dayMultipliedSubtotal + expensesSubtotal + taxAmount

  return (
    <Card>
      <h3 className="font-semibold mb-3">Summary</h3>

      <div className="space-y-1">
        {laborDaily > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Labor (daily)</span>
            <span>${laborDaily.toFixed(2)}</span>
          </div>
        )}
        {equipmentDaily > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Equipment (daily)</span>
            <span>${equipmentDaily.toFixed(2)}</span>
          </div>
        )}
        {customDaily > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Custom (daily)</span>
            <span>${customDaily.toFixed(2)}</span>
          </div>
        )}
      </div>

      {dailySubtotal > 0 && (
        <div className="border-t pt-2 mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Daily Subtotal</span>
            <span>${dailySubtotal.toFixed(2)}</span>
          </div>
          {shootDays > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">&times; {shootDays} shoot days</span>
              <span>${(dailySubtotal * shootDays).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-2 mt-2 space-y-1">
        {mileageSubtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Mileage</span>
            <span>${mileageSubtotal.toFixed(2)}</span>
          </div>
        )}
        {expensesSubtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Expenses</span>
            <span>${expensesSubtotal.toFixed(2)}</span>
          </div>
        )}
        {taxAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax ({taxRate}% on ${taxableSubtotal.toFixed(2)})</span>
            <span>${taxAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-base border-t pt-2 mt-2">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  )
}
