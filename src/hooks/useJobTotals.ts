import { useMemo } from 'react'
import { calculateTotals } from '../services/api/jobs'
import type { Job, JobItem, JobTotals } from '../types'

export function useJobTotals(allItems: JobItem[], jobs: Job[]): Map<string, JobTotals> {
  return useMemo(() => {
    const map = new Map<string, JobTotals>()
    for (const job of jobs) {
      const jobItems = allItems.filter((item) => item.jobId === job.id)
      const totals = calculateTotals(jobItems, [], job.taxRate)
      map.set(job.id, totals)
    }
    return map
  }, [allItems, jobs])
}
