import { formatDate } from '../../utils/formatDate'
import type { Communication } from '../../types'

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function CommunicationsLog({ communications }: { communications: Communication[] }) {
  if (communications.length === 0) return null

  const sorted = [...communications].sort((a, b) => a.dateSent.localeCompare(b.dateSent))

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Communications</h3>
      <table className="w-full text-sm">
        <tbody>
          {sorted.map((comm) => (
            <tr key={comm.id} className="border-b border-gray-100">
              <td className="py-1.5 pr-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  comm.type === 'quote' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {comm.type === 'quote' ? 'Quote' : 'Invoice'}
                </span>
              </td>
              <td className="py-1.5 pr-2 text-gray-600 whitespace-nowrap">{formatDate(comm.dateSent)}</td>
              <td className="py-1.5 pr-2 text-gray-500 truncate max-w-[120px]">{comm.recipients}</td>
              <td className="py-1.5 pr-2 font-medium text-right whitespace-nowrap">{formatCurrency(comm.amount)}</td>
              <td className="py-1.5 text-right">
                {comm.isResend && <span className="text-xs text-gray-400">(resend)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
