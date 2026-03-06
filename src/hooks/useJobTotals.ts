import { useMemo } from 'react'
import { calculateTotals } from '../services/api/jobs'
import type { Job, JobItem, Expense, JobTotals } from '../types'

export function useJobTotals(allItems: JobItem[], jobs: Job[], expenses: Expense[] = []): Map<string, JobTotals> {
  return useMemo(() => {
    const map = new Map<string, JobTotals>()
    for (const job of jobs) {
      const jobItems = allItems.filter((item) => item.jobId === job.id)
      const jobExpenses = expenses.filter((e) => e.jobId === job.id)
      const totals = calculateTotals(jobItems, jobExpenses, job.taxRate)
      map.set(job.id, totals)
    }
    return map
  }, [allItems, jobs, expenses])
}
