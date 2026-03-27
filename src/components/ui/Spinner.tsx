interface SpinnerProps {
  className?: string
  message?: string
}

export function Spinner({ className = '', message }: SpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
      {message && <p className="text-sm text-gray-500 mt-3">{message}</p>}
    </div>
  )
}
