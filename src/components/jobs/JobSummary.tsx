import { Card } from '../ui/Card'
import type { JobItem } from '../../types'

interface JobSummaryProps {
  items: Array<Omit<JobItem, 'id' | 'jobId' | 'jobNumber' | 'sortOrder' | 'amount'>>
  taxRate: number
  expensesSubtotal?: number
}

export function JobSummary({ items, taxRate, expensesSubtotal = 0 }: JobSummaryProps) {
  let laborTotal = 0
  let equipmentTotal = 0
  let mileageTotal = 0
  let customTotal = 0
  let taxableSubtotal = 0

  for (const item of items) {
    const fullAmount = item.type === 'mileage'
      ? item.quantity * item.rate
      : item.days * item.quantity * item.rate
    switch (item.type) {
      case 'labor': laborTotal += fullAmount; break
      case 'equipment': equipmentTotal += fullAmount; break
      case 'mileage': mileageTotal += fullAmount; break
      default: customTotal += fullAmount; break
    }
    if (item.taxable) taxableSubtotal += fullAmount
  }

  const subtotal = laborTotal + equipmentTotal + customTotal + mileageTotal
  const taxAmount = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100
  const total = subtotal + expensesSubtotal + taxAmount

  return (
    <Card>
      <h3 className="font-semibold mb-3">Summary</h3>

      <div className="space-y-1">
        {laborTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Labor</span>
            <span>${laborTotal.toFixed(2)}</span>
          </div>
        )}
        {equipmentTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Gear</span>
            <span>${equipmentTotal.toFixed(2)}</span>
          </div>
        )}
        {customTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Custom</span>
            <span>${customTotal.toFixed(2)}</span>
          </div>
        )}
        {mileageTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Mileage</span>
            <span>${mileageTotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="border-t pt-2 mt-2 space-y-1">
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
