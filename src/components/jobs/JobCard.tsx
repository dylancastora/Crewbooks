import { useState } from 'react'
import { Card } from '../ui/Card'
import { DropdownMenu } from '../ui/DropdownMenu'
import { JobStatusBadge } from './JobStatusBadge'
import { CommunicationsLog } from './CommunicationsLog'
import type { Job, JobItem, JobTotals, Communication } from '../../types'

interface PreferredAction {
  label: string
  handler: () => Promise<void>
  colorClass: string
}

interface MenuAction {
  label: string
  handler: () => Promise<void>
  isDanger?: boolean
  confirmMessage?: string
}

interface JobCardProps {
  job: Job
  clientName: string
  totals: JobTotals
  items: JobItem[]
  communications: Communication[]
  preferredAction: PreferredAction | null
  menuActions: MenuAction[]
  onNavigateEdit: () => void
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function JobCard({ job, clientName, totals, items, communications, preferredAction, menuActions }: JobCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<MenuAction | null>(null)

  const handleAction = async (handler: () => Promise<void>) => {
    setActionLoading(true)
    try {
      await handler()
    } finally {
      setActionLoading(false)
    }
  }

  const handleMenuClick = (action: MenuAction) => {
    if (action.confirmMessage) {
      setConfirmAction(action)
    } else {
      handleAction(action.handler)
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between" onClick={() => setExpanded(!expanded)}>
          <div className="flex-1 cursor-pointer">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">#{job.jobNumber}</span>
              <JobStatusBadge status={job.status} />
              {job.cancelled && <JobStatusBadge status="cancelled" />}
            </div>
            <p className="text-sm text-gray-500">{clientName}</p>
            {job.shootDates && <p className="text-xs text-gray-400">{job.shootDates}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{formatCurrency(totals.total)}</span>
            {preferredAction && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={(e) => { e.stopPropagation(); handleAction(preferredAction.handler) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] disabled:opacity-50 ${preferredAction.colorClass}`}
              >
                {actionLoading ? '...' : preferredAction.label}
              </button>
            )}
            <DropdownMenu
              items={menuActions.map((a) => ({
                label: a.label,
                onClick: () => handleMenuClick(a),
                isDanger: a.isDanger,
              }))}
            />
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t pt-4 space-y-4">
            {items.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Line Items</h3>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.description}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm font-semibold border-t mt-2 pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            )}

            <CommunicationsLog communications={communications} />

            {job.notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Notes</h3>
                <p className="text-sm text-gray-600">{job.notes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-gray-700 mb-4">{confirmAction.confirmMessage}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmAction
                  setConfirmAction(null)
                  handleAction(action.handler)
                }}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white ${confirmAction.isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
