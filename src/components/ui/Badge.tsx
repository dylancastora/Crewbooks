import { JobStatus } from '../../types'

const statusColors: Record<JobStatus, string> = {
  [JobStatus.Draft]: 'bg-gray-100 text-gray-700',
  [JobStatus.Quoted]: 'bg-blue-100 text-blue-700',
  [JobStatus.Approved]: 'bg-green-100 text-green-700',
  [JobStatus.Invoiced]: 'bg-orange-100 text-orange-700',
  [JobStatus.Paid]: 'bg-emerald-100 text-emerald-700',
}

interface BadgeProps {
  status: JobStatus
  className?: string
}

export function Badge({ status, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[status]} ${className}`}>
      {status}
    </span>
  )
}
