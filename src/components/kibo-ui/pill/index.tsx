import * as React from 'react'
import { cn } from '@/lib/utils'

type PillVariant = 'default' | 'active'

export interface PillProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PillVariant
}

export function Pill({ className, variant = 'default', ...props }: PillProps) {
  return (
    <div
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        variant === 'active'
          ? 'border-white/40 bg-[rgba(10,10,13,0.95)] text-white'
          : 'border-white/20 bg-[rgba(10,10,13,0.85)] text-white/90 hover:border-white/35 hover:bg-[rgba(10,10,13,0.95)] hover:text-white',
        className
      )}
      {...props}
    />
  )
}

export interface PillIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon: React.ComponentType<{ size?: number; className?: string }>
  size?: number
}

export function PillIcon({ icon: Icon, size = 14, className, ...props }: PillIconProps) {
  return (
    <span className={cn('inline-flex items-center justify-center', className)} {...props}>
      <Icon size={size} />
    </span>
  )
}

export function PillStatus({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center gap-1', className)} {...props} />
}

export function PillButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full text-white/80 hover:bg-white/12 hover:text-white', className)}
      type="button"
      {...props}
    />
  )
}

export function PillIndicator({
  className,
  pulse = false,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { pulse?: boolean; variant?: 'default' | 'success' | 'error' }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        variant === 'success' && 'bg-emerald-400',
        variant === 'error' && 'bg-rose-400',
        variant === 'default' && 'bg-white/70',
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    />
  )
}

export function PillDelta({
  delta,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { delta: number }) {
  const color = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-white/80'
  const value = delta > 0 ? `+${delta}%` : `${delta}%`
  return (
    <span className={cn('text-[11px] font-semibold', color, className)} {...props}>
      {value}
    </span>
  )
}

export function PillAvatarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('inline-flex -space-x-1', className)} {...props} />
}

export function PillAvatar({
  src,
  fallback,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { src?: string; fallback?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/15 text-[9px] text-white',
        className
      )}
      {...props}
    >
      {src ? <img src={src} alt={fallback ?? 'avatar'} className="h-full w-full object-cover" /> : fallback}
    </span>
  )
}
