const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  quoted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  invoiced: 'bg-orange-100 text-orange-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
