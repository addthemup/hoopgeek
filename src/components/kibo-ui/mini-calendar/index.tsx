import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

type MiniCalendarContextValue = {
  centerDate: Date
  setCenterDate: (next: Date) => void
  selectedDate: Date
  onSelectDate: (next: Date) => void
}

const MiniCalendarContext = React.createContext<MiniCalendarContextValue | null>(null)

function useMiniCalendarContext() {
  const ctx = React.useContext(MiniCalendarContext)
  if (!ctx) throw new Error('MiniCalendar components must be used inside MiniCalendar')
  return ctx
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function startOfUTCDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function MiniCalendar({
  className,
  children,
  selectedDate,
  onSelectDate,
}: React.PropsWithChildren<{
  className?: string
  selectedDate?: Date
  onSelectDate?: (next: Date) => void
}>) {
  const selected = React.useMemo(() => startOfUTCDate(selectedDate ?? new Date()), [selectedDate])
  const [centerDate, setCenterDate] = React.useState<Date>(selected)

  React.useEffect(() => {
    setCenterDate(selected)
  }, [selected])

  const handleSelectDate = React.useCallback(
    (next: Date) => {
      onSelectDate?.(startOfUTCDate(next))
    },
    [onSelectDate],
  )

  const value = React.useMemo(
    () => ({ centerDate, setCenterDate, selectedDate: selected, onSelectDate: handleSelectDate }),
    [centerDate, selected, handleSelectDate],
  )

  return (
    <MiniCalendarContext.Provider value={value}>
      <div className={cn('inline-flex items-center', className)}>{children}</div>
    </MiniCalendarContext.Provider>
  )
}

export function MiniCalendarNavigation({
  asChild,
  direction,
  children,
}: React.PropsWithChildren<{ asChild?: boolean; direction: 'prev' | 'next' }>) {
  const Comp = asChild ? Slot : 'button'
  const { centerDate, setCenterDate, selectedDate, onSelectDate } = useMiniCalendarContext()

  const handleClick = React.useCallback(() => {
    const delta = direction === 'prev' ? -1 : 1
    const nextCenter = addDays(centerDate, delta)
    const nextSelected = addDays(selectedDate, delta)
    setCenterDate(nextCenter)
    onSelectDate(nextSelected)
  }, [centerDate, direction, selectedDate, setCenterDate, onSelectDate])

  return <Comp onClick={handleClick}>{children}</Comp>
}

export function MiniCalendarDays({
  className,
  children,
}: {
  className?: string
  children: (date: Date) => React.ReactNode
}) {
  const { centerDate } = useMiniCalendarContext()
  const days = React.useMemo(() => {
    return [-2, -1, 0, 1, 2].map((offset) => addDays(centerDate, offset))
  }, [centerDate])
  return <div className={cn('inline-flex items-center', className)}>{days.map(children)}</div>
}

export function MiniCalendarDay({
  date,
  className,
}: {
  date: Date
  className?: string
}) {
  const { selectedDate, onSelectDate } = useMiniCalendarContext()
  const isSelected = dateKey(selectedDate) === dateKey(date)
  const isToday = dateKey(startOfUTCDate(new Date())) === dateKey(date)

  return (
    <button
      type="button"
      onClick={() => onSelectDate(date)}
      className={cn(
        'inline-flex min-w-12 flex-col items-center rounded-md border px-2 py-1 text-xs transition-colors',
        isSelected
          ? 'border-[#FFC72C] bg-[#FFC72C]/20 text-[#FFE082]'
          : 'border-[#333] bg-[#151515] text-[#d1d1d1] hover:border-[#555] hover:bg-[#1e1e1e]',
        className,
      )}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-80">
        {date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
      </span>
      <span className="text-sm font-semibold">{date.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' })}</span>
      {isToday && <span className="text-[9px] uppercase opacity-70">today</span>}
    </button>
  )
}

