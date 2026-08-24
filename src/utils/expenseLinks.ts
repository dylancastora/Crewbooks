import type { Expense } from '../types'

export interface ExpenseLinkState {
  /** The job being edited — empty for a job that hasn't been created yet. */
  jobId: string
  /** Client currently selected on the job form. */
  clientId: string
  /** Expenses the user added but hasn't saved yet. */
  pendingLinkIds: Set<string>
  /** Expenses the user removed but hasn't saved yet. */
  pendingUnlinkIds: Set<string>
}

export type ExpenseStatus = 'internal' | 'billed' | 'unbilled'
export type ExpenseStatusFilter = 'all' | ExpenseStatus

/**
 * Where an expense sits in its billing life: `internal` is the business's own
 * cost with no client to recover it from, `unbilled` belongs to a client but no
 * job has picked it up yet, and `billed` has been attached to one.
 *
 * Every expense lands in exactly one bucket, so all = internal + unbilled +
 * billed with nothing double-counted or dropped. Client comes first because it
 * decides whether the expense is recoverable at all; either sign of a job
 * counts as billed, so a row edited by hand in the sheet can't fall through.
 */
export function expenseStatus(expense: Expense): ExpenseStatus {
  if (!expense.clientId) return 'internal'
  return expense.jobId || expense.billed ? 'billed' : 'unbilled'
}

export function matchesExpenseStatus(expense: Expense, filter: ExpenseStatusFilter): boolean {
  return filter === 'all' || expenseStatus(expense) === filter
}

export function isLinkedToJob(expense: Expense, state: ExpenseLinkState): boolean {
  if (state.pendingLinkIds.has(expense.id)) return true
  if (!state.jobId) return false
  return expense.jobId === state.jobId && !state.pendingUnlinkIds.has(expense.id)
}

/**
 * Split expenses into the job's linked set and the set still available to add.
 *
 * Both lists are filters over the same array, so every expense is classified
 * exactly once: repeated Add/Remove taps can't put one expense in both lists or
 * list it twice in either. Pending state is layered over what's saved, so the
 * UI stays correct while a save is still in flight.
 */
export function partitionExpenses(
  expenses: Expense[],
  state: ExpenseLinkState,
): { linked: Expense[]; available: Expense[] } {
  const linked: Expense[] = []
  const available: Expense[] = []

  for (const expense of expenses) {
    if (isLinkedToJob(expense, state)) {
      linked.push(expense)
    } else if (
      expense.clientId === state.clientId &&
      (!expense.billed || state.pendingUnlinkIds.has(expense.id))
    ) {
      available.push(expense)
    }
  }

  return { linked, available }
}

/**
 * The writes needed to make the sheet match the pending state — diffed against
 * what's stored, so toggling an expense off and back on costs nothing.
 */
export function buildExpenseLinkUpdates(
  expenses: Expense[],
  jobId: string,
  pendingLinkIds: Set<string>,
  pendingUnlinkIds: Set<string>,
): Expense[] {
  return expenses.flatMap<Expense>((expense) => {
    if (pendingLinkIds.has(expense.id) && (expense.jobId !== jobId || !expense.billed)) {
      return [{ ...expense, jobId, billed: true }]
    }
    if (pendingUnlinkIds.has(expense.id) && (expense.jobId !== '' || expense.billed)) {
      return [{ ...expense, jobId: '', billed: false }]
    }
    return []
  })
}
