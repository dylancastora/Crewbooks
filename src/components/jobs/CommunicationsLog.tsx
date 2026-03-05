import type { Communication } from '../../types'

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function CommunicationsLog({ communications }: { communications: Communication[] }) {
  if (communications.length === 0) return null

  const sorted = [...communications].sort((a, b) => a.dateSent.localeCompare(b.dateSent))

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Communications</h3>
      <div className="space-y-2">
        {sorted.map((comm) => (
          <div key={comm.id} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              comm.type === 'quote' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {comm.type === 'quote' ? 'Quote' : 'Invoice'}
            </span>
            <span className="text-gray-600">{formatDate(comm.dateSent)}</span>
            <span className="text-gray-500 truncate flex-1">{comm.recipients}</span>
            <span className="font-medium">{formatCurrency(comm.amount)}</span>
            {comm.isResend && (
              <span className="text-xs text-gray-400">(resend)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
