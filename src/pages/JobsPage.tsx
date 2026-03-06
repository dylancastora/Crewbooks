import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { useJobItems } from '../hooks/useJobItems'
import { useCommunications } from '../hooks/useCommunications'
import { useJobActions } from '../hooks/useJobActions'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { JobCard } from '../components/jobs/JobCard'
import { JobStatus } from '../types'

const statusFilters = ['All', JobStatus.Draft, JobStatus.Quoted, JobStatus.Approved, JobStatus.Invoiced, JobStatus.Paid, 'cancelled'] as const

export function JobsPage() {
  const navigate = useNavigate()
  const { clients } = useClients()
  const { jobs, getPreferredAction, getMenuActions, totalsMap, allExpenses, getItemsForJob, getForJob } = useJobActions()
  const { loading: itemsLoading } = useJobItems()
  const { loading: commsLoading } = useCommunications()
  const [filter, setFilter] = useState<string>('All')

  const loading = itemsLoading || commsLoading

  const filteredJobs = filter === 'All'
    ? jobs
    : filter === 'cancelled'
      ? jobs.filter((j) => j.cancelled)
      : jobs.filter((j) => j.status === filter && !j.cancelled)

  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.company || 'Unknown'

  if (loading) return <Spinner className="py-12" />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Button onClick={() => navigate('/jobs/new')} size="sm">+ New Job</Button>
      </div>

      <div className="mb-4">
        <Select
          value={filter}
          options={statusFilters.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState message="No jobs found." actionLabel="Create Job" onAction={() => navigate('/jobs/new')} />
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((job) => (
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
