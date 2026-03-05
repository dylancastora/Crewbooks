import { useState } from 'react'

interface DatePickerProps {
  selectedDates: string[]
  onChange: (dates: string[]) => void
  label?: string
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function DatePicker({ selectedDates, onChange, label }: DatePickerProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  const toggleDate = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      onChange(selectedDates.filter((d) => d !== dateStr))
    } else {
      onChange([...selectedDates, dateStr].sort())
    }
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={prevMonth} className="p-1 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-500 hover:text-gray-800">
            ‹
          </button>
          <span className="text-sm font-medium">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button type="button" onClick={nextMonth} className="p-1 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-500 hover:text-gray-800">
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-xs text-gray-400 py-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />
            const dateStr = formatDate(viewYear, viewMonth, day)
            const isSelected = selectedDates.includes(dateStr)
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => toggleDate(dateStr)}
                className={`w-full aspect-square flex items-center justify-center text-sm rounded-full min-h-[36px] transition-colors ${
                  isSelected
                    ? 'bg-primary text-white font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
        {selectedDates.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500">{selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedDates.map((d) => (
                <span key={d} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
