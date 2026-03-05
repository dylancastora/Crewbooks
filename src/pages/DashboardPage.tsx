import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobs } from '../hooks/useJobs'
import { useClients } from '../hooks/useClients'
import { useJobItems } from '../hooks/useJobItems'
import { useCommunications } from '../hooks/useCommunications'
import { useJobActions } from '../hooks/useJobActions'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { JobCard } from '../components/jobs/JobCard'
import { JobStatus } from '../types'

type Tab = 'upcoming' | 'past'

export function DashboardPage() {
  const navigate = useNavigate()
  const { clients } = useClients()
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')

  const { jobs, getPreferredAction, getMenuActions, totalsMap, getItemsForJob, getForJob } = useJobActions()
  const { loading: itemsLoading } = useJobItems()
  const { loading: commsLoading } = useCommunications()
  const { loading: jobsLoading } = useJobs()

  const loading = jobsLoading || itemsLoading || commsLoading

  if (loading) return <Spinner className="py-12" />

  const currentYear = new Date().getFullYear()
  const today = new Date().toISOString().split('T')[0]

  const activeJobs = jobs.filter((j) => !j.cancelled)

  // Earnings: paid jobs this year
  const earnings = activeJobs
    .filter((j) => j.status === JobStatus.Paid)
    .reduce((sum, j) => sum + (totalsMap.get(j.id)?.total || 0), 0)

  // Receivables: invoiced jobs
  const receivables = activeJobs
    .filter((j) => j.status === JobStatus.Invoiced)
    .reduce((sum, j) => sum + (totalsMap.get(j.id)?.total || 0), 0)

  // Pipeline: draft, quoted, approved
  const pipelineStatuses = [JobStatus.Draft, JobStatus.Quoted, JobStatus.Approved] as string[]
  const pipeline = activeJobs
    .filter((j) => pipelineStatuses.includes(j.status))
    .reduce((sum, j) => sum + (totalsMap.get(j.id)?.total || 0), 0)

  // Split jobs into upcoming and past
  const upcomingJobs = jobs.filter((j) => {
    if (j.status === JobStatus.Paid) return false
    if (j.cancelled) return false
    if (!j.shootDates) return true
    const dates = j.shootDates.split(',').map((d) => d.trim()).filter(Boolean)
    return dates.some((d) => d >= today)
  }).sort((a, b) => {
    const aDate = a.shootDates?.split(',')[0]?.trim() || '9999'
    const bDate = b.shootDates?.split(',')[0]?.trim() || '9999'
    return aDate.localeCompare(bDate)
  })

  const pastJobs = jobs.filter((j) => {
    if (j.cancelled) return false
    if (j.status === JobStatus.Paid) return true
    if (!j.shootDates) return false
    const dates = j.shootDates.split(',').map((d) => d.trim()).filter(Boolean)
    return dates.every((d) => d < today)
  }).sort((a, b) => {
    const aDate = a.shootDates?.split(',').pop()?.trim() || ''
    const bDate = b.shootDates?.split(',').pop()?.trim() || ''
    return bDate.localeCompare(aDate)
  })

  const displayedJobs = activeTab === 'upcoming' ? upcomingJobs : pastJobs
  const getClientName = (clientId: string) => clients.find((c) => c.id === clientId)?.company || 'Unknown'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <p className="text-sm text-gray-500">Earnings ({currentYear})</p>
          <p className="text-2xl font-bold text-green-600">${earnings.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Receivables</p>
          <p className="text-2xl font-bold">${receivables.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Pipeline</p>
          <p className="text-2xl font-bold text-primary">${pipeline.toFixed(2)}</p>
        </Card>
      </div>

      <div className="flex border-b mb-3">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'upcoming' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Upcoming ({upcomingJobs.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'past' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Past ({pastJobs.length})
        </button>
      </div>

      {displayedJobs.length === 0 ? (
        <p className="text-gray-500 py-4">No {activeTab} jobs.</p>
      ) : (
        <div className="space-y-2">
          {displayedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              clientName={getClientName(job.clientId)}
              totals={totalsMap.get(job.id) || { laborSubtotal: 0, equipmentSubtotal: 0, mileageSubtotal: 0, customSubtotal: 0, expensesSubtotal: 0, taxableSubtotal: 0, taxAmount: 0, total: 0 }}
              items={getItemsForJob(job.id)}
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
