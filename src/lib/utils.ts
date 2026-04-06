/**
 * Class name utility for Kibo UI / shadcn-style components.
 * Use with Tailwind to merge and dedupe classes.
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** MUI-style spacing (1 unit = 8px). Used by Kibo Box when migrating from MUI Joy. */
const SPACING = 8
function spacing(n: number): number {
  return n * SPACING
}

/** Convert simple MUI-style sx object to React.CSSProperties for migration compatibility. */
export function sxToStyle(sx: Record<string, unknown> | undefined): React.CSSProperties {
  if (!sx || typeof sx !== 'object') return {}
  const style: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(sx)) {
    if (value === undefined) continue
    if (key === 'bgcolor') {
      style.backgroundColor = value as string
    } else if (key === 'color') {
      style.color = value as string
    } else if (['p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'gap'].includes(key) && typeof value === 'number') {
      const v = spacing(value)
      if (key === 'p') style.padding = v
      else if (key === 'px') { style.paddingLeft = v; style.paddingRight = v }
      else if (key === 'py') { style.paddingTop = v; style.paddingBottom = v }
      else if (key === 'pt') style.paddingTop = v
      else if (key === 'pb') style.paddingBottom = v
      else if (key === 'pl') style.paddingLeft = v
      else if (key === 'pr') style.paddingRight = v
      else if (key === 'm') style.margin = v
      else if (key === 'mx') { style.marginLeft = v; style.marginRight = v }
      else if (key === 'my') { style.marginTop = v; style.marginBottom = v }
      else if (key === 'mt') style.marginTop = v
      else if (key === 'mb') style.marginBottom = v
      else if (key === 'ml') style.marginLeft = v
      else if (key === 'mr') style.marginRight = v
      else if (key === 'gap') style.gap = v
    } else if (key === 'borderRadius' && typeof value === 'number') {
      style.borderRadius = spacing(value)
    } else if (typeof value === 'string' || typeof value === 'number') {
      style[key] = value
    }
  }
  return style as React.CSSProperties
}
