import { ItemType } from '../types'

/**
 * What a line item comes to, from the inputs beside it.
 *
 * `amount` is a locked, app-managed column in the sheet, while `days`,
 * `quantity` and `rate` are meant to be edited by hand — so the stored amount
 * is a cache of this, and this is the answer. Deriving it means a rate fixed in
 * the spreadsheet flows through to the totals, the invoice and the PDF instead
 * of leaving a row whose amount silently disagrees with its own numbers.
 *
 * Rounded to cents: these are dollars, and unrounded products
 * (120 × 0.67 = 80.39999999999999) accumulate through every subtotal.
 */
export function lineItemAmount(item: { type: string; days: number; quantity: number; rate: number }): number {
  const raw = item.type === ItemType.Mileage
    ? item.quantity * item.rate
    : item.days * item.quantity * item.rate
  return Math.round(raw * 100) / 100
}

/**
 * The label for a mileage row.
 *
 * Mileage descriptions restate the numbers next to them, so they are derived
 * from `quantity` and `rate` rather than stored as authored text — a row edited
 * straight in the spreadsheet would otherwise keep a label quoting the old rate
 * while the amount reflected the new one, and quotes and invoices print the
 * label.
 */
export function mileageDescription(quantity: number, rate: number): string {
  return `Mileage (${quantity} mi @ $${rate}/mi)`
}
