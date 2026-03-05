import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface DropdownItem {
  label: string
  onClick: () => void
  isDanger?: boolean
}

interface DropdownMenuProps {
  items: DropdownItem[]
  trigger?: ReactNode
}

export function DropdownMenu({ items, trigger }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
      >
        {trigger || '⋯'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border min-w-[180px] py-1 z-50">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                item.onClick()
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${item.isDanger ? 'text-red-600' : 'text-gray-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
