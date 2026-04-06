/**
 * Kibo Box – layout primitive (replaces MUI Joy Box).
 * Prefer className + Tailwind; sx is supported for migration only.
 */
import * as React from 'react'
import { cn, sxToStyle } from '@/lib/utils'

type BoxProps = React.ComponentPropsWithoutRef<'div'> & {
  component?: React.ElementType
  /** Migration compat: simple object only; prefer className. */
  sx?: Record<string, unknown>
}

const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  ({ component: Component = 'div', sx, className, style, ...props }, ref) => {
    const sxStyle = sxToStyle(sx)
    return (
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(className)}
        style={{ ...sxStyle, ...style }}
        {...props}
      />
    )
  }
)
Box.displayName = 'Box'

export { Box }
