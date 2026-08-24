import { describe, it, expect } from 'vitest'
import { partitionExpenses, buildExpenseLinkUpdates, matchesExpenseStatus, expenseStatus } from './expenseLinks'
import type { Expense } from '../types'

const JOB = 'job-1'
const CLIENT = 'client-1'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: crypto.randomUUID(),
    jobId: '',
    clientId: CLIENT,
    description: 'Parking',
    amount: 25,
    date: '2026-01-01',
    category: 'Parking',
    receiptFileId: '',
    receiptFileName: '',
    billed: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function state(overrides: Partial<Parameters<typeof partitionExpenses>[1]> = {}) {
  return {
    jobId: JOB,
    clientId: CLIENT,
    pendingLinkIds: new Set<string>(),
    pendingUnlinkIds: new Set<string>(),
    ...overrides,
  }
}

describe('partitionExpenses', () => {
  it('lists a saved-linked expense as linked, not available', () => {
    const expense = makeExpense({ jobId: JOB, billed: true })
    const { linked, available } = partitionExpenses([expense], state())
    expect(linked).toEqual([expense])
    expect(available).toEqual([])
  })

  it('offers an unbilled expense for the same client', () => {
    const expense = makeExpense()
    const { linked, available } = partitionExpenses([expense], state())
    expect(linked).toEqual([])
    expect(available).toEqual([expense])
  })

  it('hides expenses billed to another job', () => {
    const expense = makeExpense({ jobId: 'other-job', billed: true })
    const { linked, available } = partitionExpenses([expense], state())
    expect(linked).toEqual([])
    expect(available).toEqual([])
  })

  it('hides expenses belonging to a different client', () => {
    const expense = makeExpense({ clientId: 'client-2' })
    const { available } = partitionExpenses([expense], state())
    expect(available).toEqual([])
  })

  // The reported bug: tapping Remove repeatedly listed the expense once per tap.
  it('lists a removed expense exactly once no matter how many removals queue up', () => {
    const expense = makeExpense({ jobId: JOB, billed: true })
    const removedTwice = state({ pendingUnlinkIds: new Set([expense.id, expense.id]) })

    const { linked, available } = partitionExpenses([expense], removedTwice)

    expect(linked).toEqual([])
    expect(available).toEqual([expense])
    expect(available.filter((e) => e.id === expense.id)).toHaveLength(1)
  })

  it('never places one expense in both lists', () => {
    const expense = makeExpense({ jobId: JOB, billed: true })
    // Contradictory pending state — linked wins, and it appears only once.
    const conflicting = state({
      pendingLinkIds: new Set([expense.id]),
      pendingUnlinkIds: new Set([expense.id]),
    })

    const { linked, available } = partitionExpenses([expense], conflicting)

    expect(linked).toHaveLength(1)
    expect(available).toHaveLength(0)
  })

  it('shows a pending link as linked before it is saved', () => {
    const expense = makeExpense()
    const { linked, available } = partitionExpenses([expense], state({
      pendingLinkIds: new Set([expense.id]),
    }))
    expect(linked).toEqual([expense])
    expect(available).toEqual([])
  })

  it('treats nothing as linked on a job that does not exist yet', () => {
    const expense = makeExpense({ jobId: '', billed: false })
    const { linked, available } = partitionExpenses([expense], state({ jobId: '' }))
    expect(linked).toEqual([])
    expect(available).toEqual([expense])
  })

  it('keeps a linked expense visible once while its save is still in flight', () => {
    // The sheet write landed (jobId set) but the pending set has not cleared yet.
    const expense = makeExpense({ jobId: JOB, billed: true })
    const { linked } = partitionExpenses([expense], state({
      pendingLinkIds: new Set([expense.id]),
    }))
    expect(linked).toHaveLength(1)
  })
})

describe('expenseStatus', () => {
  it('calls an expense attached to a job billed', () => {
    expect(expenseStatus(makeExpense({ jobId: JOB, billed: true }))).toBe('billed')
  })

  it('calls an expense with a client but no job unbilled', () => {
    expect(expenseStatus(makeExpense({ jobId: '', billed: false }))).toBe('unbilled')
  })

  it('calls an expense with no client internal', () => {
    expect(expenseStatus(makeExpense({ clientId: '', jobId: '', billed: false }))).toBe('internal')
  })

  it('treats an expense detached from a deleted job as unbilled again', () => {
    expect(expenseStatus(makeExpense({ jobId: '', billed: false, clientId: CLIENT }))).toBe('unbilled')
  })

  // Hand-edits in the sheet can leave the two signals disagreeing; either one
  // counts as billed so the expense never slips into the wrong bucket.
  it('counts either signal of a job as billed', () => {
    expect(expenseStatus(makeExpense({ jobId: JOB, billed: false }))).toBe('billed')
    expect(expenseStatus(makeExpense({ jobId: '', billed: true }))).toBe('billed')
  })

  it('classes a clientless expense as internal even if it looks billed', () => {
    expect(expenseStatus(makeExpense({ clientId: '', jobId: JOB, billed: true }))).toBe('internal')
  })
})

describe('matchesExpenseStatus', () => {
  // Every combination of the three fields that decide an expense's status.
  const everyShape = [CLIENT, ''].flatMap((clientId) =>
    [JOB, ''].flatMap((jobId) =>
      [true, false].map((billed) => makeExpense({ clientId, jobId, billed })),
    ),
  )

  it('lets everything through on "all"', () => {
    expect(everyShape.filter((e) => matchesExpenseStatus(e, 'all'))).toHaveLength(everyShape.length)
  })

  // all = billed + unbilled + internal, with nothing counted twice or dropped.
  it('splits every expense into exactly one bucket', () => {
    const buckets = (['billed', 'unbilled', 'internal'] as const)
      .map((status) => everyShape.filter((e) => matchesExpenseStatus(e, status)))

    expect(buckets.flat()).toHaveLength(everyShape.length)
    expect(new Set(buckets.flat().map((e) => e.id)).size).toBe(everyShape.length)
  })

  it('shows only clientless expenses on "internal"', () => {
    const internal = everyShape.filter((e) => matchesExpenseStatus(e, 'internal'))
    expect(internal.length).toBeGreaterThan(0)
    expect(internal.every((e) => !e.clientId)).toBe(true)
  })
})

describe('buildExpenseLinkUpdates', () => {
  it('links pending expenses to the job and marks them billed', () => {
    const expense = makeExpense()
    const updates = buildExpenseLinkUpdates([expense], JOB, new Set([expense.id]), new Set())
    expect(updates).toEqual([{ ...expense, jobId: JOB, billed: true }])
  })

  it('clears the job and billed flag on unlink', () => {
    const expense = makeExpense({ jobId: JOB, billed: true })
    const updates = buildExpenseLinkUpdates([expense], JOB, new Set(), new Set([expense.id]))
    expect(updates).toEqual([{ ...expense, jobId: '', billed: false }])
  })

  it('writes nothing when the pending state already matches the sheet', () => {
    const linked = makeExpense({ jobId: JOB, billed: true })
    const unlinked = makeExpense()
    const updates = buildExpenseLinkUpdates(
      [linked, unlinked],
      JOB,
      new Set([linked.id]),
      new Set([unlinked.id]),
    )
    expect(updates).toEqual([])
  })

  it('emits one update per expense even when it was toggled repeatedly', () => {
    const expense = makeExpense({ jobId: JOB, billed: true })
    const updates = buildExpenseLinkUpdates(
      [expense],
      JOB,
      new Set(),
      new Set([expense.id, expense.id]),
    )
    expect(updates).toHaveLength(1)
  })
})
