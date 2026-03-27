import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { useJobActions } from '../hooks/useJobActions'
import { useDataContext } from '../context/DataProvider'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
import { JobCard } from '../components/jobs/JobCard'
import { JobStatus } from '../types'

const statusFilters = ['Upcoming', 'Past', 'All', JobStatus.Draft, JobStatus.Quoted, JobStatus.Approved, JobStatus.Invoiced, JobStatus.Paid, 'cancelled'] as const

type SortField = 'date' | 'number' | 'amount'

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Job Date' },
  { value: 'number', label: 'Job Number' },
  { value: 'amount', label: 'Total Amount' },
]

export function JobsPage() {
  const navigate = useNavigate()
  const { clients } = useClients()
  const { jobs, getPreferredAction, getMenuActions, totalsMap, allExpenses, getItemsForJob, getForJob } = useJobActions()
  const { loading } = useDataContext()
  const [filter, setFilter] = useState<string>('Upcoming')
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortAsc, setSortAsc] = useState(true)

  const activeJobs = jobs.filter((j) => !j.cancelled)
  const today = new Date().toISOString().split('T')[0]

  const earnings = activeJobs
    .filter((j) => j.status === JobStatus.Paid)
    .reduce((sum, j) => sum + (totalsMap.get(j.id)?.total || 0), 0)

  const receivables = activeJobs
    .filter((j) => j.status === JobStatus.Invoiced)
    .reduce((sum, j) => sum + (totalsMap.get(j.id)?.total || 0), 0)

  const pipelineStatuses = [JobStatus.Draft, JobStatus.Quoted, JobStatus.Approved] as string[]
  const pipeline = activeJobs
    .filter((j) => pipelineStatuses.includes(j.status))
    .reduce((sum, j) => sum + (totalsMap.get(j.id)?.total || 0), 0)

  const filteredJobs = filter === 'All'
    ? jobs
    : filter === 'Upcoming'
      ? jobs.filter((j) => {
          if (j.cancelled || j.status === JobStatus.Paid) return false
          if (!j.shootDates) return true
          const dates = j.shootDates.split(',').map((d) => d.trim()).filter(Boolean)
          return dates.some((d) => d >= today)
        })
      : filter === 'Past'
        ? jobs.filter((j) => {
            if (j.cancelled) return false
            if (j.status === JobStatus.Paid) return true
            if (!j.shootDates) return false
            const dates = j.shootDates.split(',').map((d) => d.trim()).filter(Boolean)
            return dates.every((d) => d < today)
          })
        : filter === 'cancelled'
          ? jobs.filter((j) => j.cancelled)
          : jobs.filter((j) => j.status === filter && !j.cancelled)

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'date') {
      const aDate = a.shootDates?.split(',')[0]?.trim() || ''
      const bDate = b.shootDates?.split(',')[0]?.trim() || ''
      cmp = aDate.localeCompare(bDate)
    } else if (sortBy === 'number') {
      cmp = a.jobNumber.localeCompare(b.jobNumber)
    } else {
      const aTotal = totalsMap.get(a.id)?.total || 0
      const bTotal = totalsMap.get(b.id)?.total || 0
      cmp = aTotal - bTotal
    }
    return sortAsc ? cmp : -cmp
  })

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.company || 'Unknown'

  if (loading) return <Spinner className="py-12" />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Button onClick={() => navigate('/jobs/new')} size="sm">+ New Job</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="!p-3" onClick={() => setFilter(JobStatus.Paid)}>
          <p className="text-xs text-gray-500">Earnings YTD</p>
          <p className="text-lg font-bold text-green-600">${earnings.toFixed(2)}</p>
        </Card>
        <Card className="!p-3" onClick={() => setFilter(JobStatus.Invoiced)}>
          <p className="text-xs text-gray-500">Receivables</p>
          <p className="text-lg font-bold">${receivables.toFixed(2)}</p>
        </Card>
        <Card className="!p-3" onClick={() => setFilter('Upcoming')}>
          <p className="text-xs text-gray-500">Pipeline</p>
          <p className="text-lg font-bold text-primary">${pipeline.toFixed(2)}</p>
        </Card>
      </div>

      <div className="flex gap-2 mb-4 items-end">
        <div className="w-full">
          <p className="text-xs text-gray-500 mb-1">Filter by</p>
          <Select
            value={filter}
            options={statusFilters.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="w-full">
          <p className="text-xs text-gray-500 mb-1">Sort by</p>
          <Select
            value={sortBy}
            options={sortOptions}
            onChange={(e) => setSortBy(e.target.value as SortField)}
          />
        </div>
        <button
          type="button"
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors text-lg"
          title={sortAsc ? 'Ascending' : 'Descending'}
        >
          {sortAsc ? '↑' : '↓'}
        </button>
      </div>

      {sortedJobs.length === 0 ? (
        <p className="text-gray-500 py-4 text-center">No jobs found.</p>
      ) : (
        <div className="space-y-2">
          {sortedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              clientName={getClientName(job.clientId)}
              totals={totalsMap.get(job.id) || { laborSubtotal: 0, equipmentSubtotal: 0, mileageSubtotal: 0, customSubtotal: 0, expensesSubtotal: 0, taxableSubtotal: 0, taxAmount: 0, total: 0 }}
              items={getItemsForJob(job.id)}
              expenses={allExpenses.filter((e) => e.jobId === job.id)}
              communications={getForJob(job.id)}
              preferredAction={getPreferredAction(job)}
              menuActions={getMenuActions(job, () => navigate(`/jobs/${job.id}`))}
              onNavigateEdit={() => navigate(`/jobs/${job.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
