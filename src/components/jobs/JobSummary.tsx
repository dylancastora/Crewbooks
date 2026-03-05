import { Card } from '../ui/Card'
import type { JobItem } from '../../types'

interface JobSummaryProps {
  items: Array<Omit<JobItem, 'id' | 'jobId' | 'jobNumber' | 'sortOrder' | 'amount'>>
  taxRate: number
  shootDays: number
  expensesSubtotal?: number
}

export function JobSummary({ items, taxRate, shootDays, expensesSubtotal = 0 }: JobSummaryProps) {
  let laborSubtotal = 0
  let equipmentSubtotal = 0
  let mileageSubtotal = 0
  let customSubtotal = 0
  let taxableSubtotal = 0

  for (const item of items) {
    const amount = item.type === 'mileage'
      ? item.quantity * item.rate
      : shootDays * item.quantity * item.rate
    switch (item.type) {
      case 'labor': laborSubtotal += amount; break
      case 'equipment': equipmentSubtotal += amount; break
      case 'mileage': mileageSubtotal += amount; break
      default: customSubtotal += amount; break
    }
    if (item.taxable) taxableSubtotal += amount
  }

  const taxAmount = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100
  const total = laborSubtotal + equipmentSubtotal + mileageSubtotal + customSubtotal + expensesSubtotal + taxAmount

  return (
    <Card>
      <h3 className="font-semibold mb-3">Summary</h3>

      <div className="space-y-1">
        {items.map((item, i) => {
          const amount = item.type === 'mileage'
            ? item.quantity * item.rate
            : shootDays * item.quantity * item.rate
          return (
            <div key={i} className="flex justify-between text-sm py-0.5">
              <span className="text-gray-600">
                {item.description || item.type}
                {item.type !== 'mileage' && shootDays > 1 ? ` (${shootDays}d)` : ''}
              </span>
              <span>${amount.toFixed(2)}</span>
            </div>
          )
        })}
      </div>

      <div className="border-t pt-2 mt-2 space-y-1">
        {laborSubtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Labor</span>
            <span>${laborSubtotal.toFixed(2)}</span>
          </div>
        )}
        {equipmentSubtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Equipment</span>
            <span>${equipmentSubtotal.toFixed(2)}</span>
          </div>
        )}
        {mileageSubtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Mileage</span>
            <span>${mileageSubtotal.toFixed(2)}</span>
          </div>
        )}
        {customSubtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Custom</span>
            <span>${customSubtotal.toFixed(2)}</span>
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
