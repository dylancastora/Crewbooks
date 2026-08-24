import { describe, it, expect, vi, afterEach } from 'vitest'
import { getJobItems } from './jobItems'
import { mileageDescription, lineItemAmount } from '../../utils/lineItems'

const SHEET = 'sheet-1'
const TOKEN = 'token'
const JOB = 'job-1'

const COLUMNS = ['id', 'jobId', 'jobNumber', 'type', 'description', 'days', 'quantity', 'rate', 'taxable', 'sortOrder', 'amount']

function stubSheet(rows: string[][]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: async () => ({ values: [COLUMNS, ...rows] }),
  })))
}

describe('mileageDescription', () => {
  it('states the miles and the rate', () => {
    expect(mileageDescription(120, 0.67)).toBe('Mileage (120 mi @ $0.67/mi)')
  })
})

describe('lineItemAmount', () => {
  it('multiplies days, quantity and rate for day-rate items', () => {
    expect(lineItemAmount({ type: 'labor', days: 3, quantity: 2, rate: 500 })).toBe(3000)
  })

  it('ignores days for mileage', () => {
    expect(lineItemAmount({ type: 'mileage', days: 0, quantity: 120, rate: 0.67 })).toBe(80.4)
  })

  it('rounds to cents so products do not drift through the subtotals', () => {
    // 120 * 0.67 is 80.39999999999999 in floating point.
    expect(lineItemAmount({ type: 'mileage', days: 0, quantity: 120, rate: 0.67 }))
      .toBe(80.4)
    expect(lineItemAmount({ type: 'labor', days: 1, quantity: 3, rate: 0.1 })).toBe(0.3)
  })
})

describe('getJobItems recalculates app-managed columns', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  // amount is a locked column in the sheet; days/quantity/rate are the ones
  // meant to be hand-edited, so a stale amount must never win.
  it('recomputes a stale amount after the rate is corrected by hand', async () => {
    stubSheet([
      ['item-1', JOB, '0042', 'labor', 'Gaffer', '2', '1', '600', 'false', '0', '1400'],
    ])

    const [item] = await getJobItems(SHEET, JOB, TOKEN)

    expect(item.amount).toBe(1200)
  })

  it('recomputes after quantity or days are corrected by hand', async () => {
    stubSheet([
      ['item-1', JOB, '0042', 'equipment', 'Camera package', '3', '2', '250', 'true', '0', '250'],
    ])

    const [item] = await getJobItems(SHEET, JOB, TOKEN)

    expect(item.amount).toBe(1500)
  })

  it('keeps the mileage amount and label agreeing with each other', async () => {
    stubSheet([
      ['item-1', JOB, '0042', 'mileage', 'Mileage (120 mi @ $0.72/mi)', '0', '120', '0.67', 'false', '0', '86.40'],
    ])

    const [item] = await getJobItems(SHEET, JOB, TOKEN)

    expect(item.description).toBe('Mileage (120 mi @ $0.67/mi)')
    expect(item.amount).toBe(80.4)
  })
})

describe('getJobItems mileage labels', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  // The reported bug: the rate was corrected straight in the spreadsheet, so
  // rate and amount were right but the stored label still quoted the old rate —
  // and the label is what the invoice PDF and email body print.
  it('rebuilds a stale label from the rate stored on the row', async () => {
    stubSheet([
      ['item-1', JOB, '0042', 'mileage', 'Mileage (120 mi @ $0.72/mi)', '0', '120', '0.67', 'false', '0', '80.40'],
    ])

    const [item] = await getJobItems(SHEET, JOB, TOKEN)

    expect(item.description).toBe('Mileage (120 mi @ $0.67/mi)')
    expect(item.amount).toBe(80.4)
  })

  it('leaves labels on other line item types alone', async () => {
    stubSheet([
      ['item-1', JOB, '0042', 'labor', 'Director of Photography', '1', '1', '1200', 'false', '0', '1200'],
    ])

    const [item] = await getJobItems(SHEET, JOB, TOKEN)

    expect(item.description).toBe('Director of Photography')
  })

  it('handles a mileage row with no miles entered yet', async () => {
    stubSheet([
      ['item-1', JOB, '0042', 'mileage', '', '0', '', '0.72', 'false', '0', '0'],
    ])

    const [item] = await getJobItems(SHEET, JOB, TOKEN)

    expect(item.description).toBe('Mileage (0 mi @ $0.72/mi)')
  })
})
