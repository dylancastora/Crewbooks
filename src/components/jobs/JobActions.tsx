import { useState } from 'react'
import { Button } from '../ui/Button'
import { DropdownMenu } from '../ui/DropdownMenu'
import { JobStatusBadge } from './JobStatusBadge'
import type { Job } from '../../types'

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

interface JobActionsProps {
  job: Job
  preferredAction: PreferredAction | null
  menuActions: MenuAction[]
  onSave: () => void
  saving: boolean
}

export function JobActions({ job, preferredAction, menuActions, onSave, saving }: JobActionsProps) {
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
      <div className="space-y-3">
        <div className="text-center py-2 flex items-center justify-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <JobStatusBadge status={job.status} />
          {job.cancelled && <JobStatusBadge status="cancelled" />}
        </div>

        <div className="flex gap-2">
          <Button onClick={onSave} disabled={saving || actionLoading} variant="secondary" className="flex-1">
            {saving ? 'Saving...' : 'Save'}
          </Button>

          {preferredAction && (
            <button
              type="button"
              onClick={() => handleAction(preferredAction.handler)}
              disabled={saving || actionLoading}
              className={`flex-1 rounded-lg py-3 font-semibold text-base min-h-[48px] disabled:opacity-50 ${preferredAction.colorClass}`}
            >
              {actionLoading ? '...' : preferredAction.label}
            </button>
          )}

          {menuActions.length > 0 && (
            <DropdownMenu
              items={menuActions.map((a) => ({
                label: a.label,
                onClick: () => handleMenuClick(a),
                isDanger: a.isDanger,
              }))}
            />
          )}
        </div>
      </div>

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
                {confirmAction.label === 'Cancel' ? 'Keep Job' : 'Cancel'}
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
                {confirmAction.label === 'Cancel' ? 'Cancel Job' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
