/**
 * Kibo Stack – flex column/row with gap (replaces MUI Joy Stack).
 */
import * as React from 'react'
import { cn, sxToStyle } from '@/lib/utils'

type StackProps = React.ComponentPropsWithoutRef<'div'> & {
  direction?: 'row' | 'column'
  spacing?: number
  /** Migration compat. */
  sx?: Record<string, unknown>
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ direction = 'column', spacing = 0, sx, className, style, ...props }, ref) => {
    const sxStyle = sxToStyle(sx)
    const gap = spacing * 8 // 8px units
    return (
      <div
        ref={ref}
        className={cn('flex', direction === 'row' ? 'flex-row' : 'flex-col', className)}
        style={{ gap: gap || undefined, ...sxStyle, ...style }}
        {...props}
      />
    )
  }
)
Stack.displayName = 'Stack'

export { Stack }
