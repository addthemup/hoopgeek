/**
 * Kibo Typography – text primitive (replaces MUI Joy Typography).
 * Use level for semantic size; prefer className for one-offs.
 */
import * as React from 'react'
import { cn, sxToStyle } from '@/lib/utils'

const levelClasses: Record<string, string> = {
  h1: 'text-3xl font-bold tracking-tight',
  h2: 'text-2xl font-semibold tracking-tight',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-medium',
  'body-lg': 'text-lg',
  'body-md': 'text-base',
  'body-sm': 'text-sm',
  'body-xs': 'text-xs',
}

type TypographyProps = React.ComponentPropsWithoutRef<'span'> & {
  component?: React.ElementType
  level?: keyof typeof levelClasses | 'h1' | 'h2' | 'h3' | 'h4'
  /** Migration compat. */
  sx?: Record<string, unknown>
}

const Typography = React.forwardRef<HTMLSpanElement, TypographyProps>(
  ({ component: Component = 'span', level, sx, className, style, ...props }, ref) => {
    const sxStyle = sxToStyle(sx)
    const levelClass = level ? levelClasses[level] : ''
    return (
      <Component
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn(levelClass, className)}
        style={sxStyle ? { ...sxStyle, ...style } : style}
        {...props}
      />
    )
  }
)
Typography.displayName = 'Typography'

export { Typography }
