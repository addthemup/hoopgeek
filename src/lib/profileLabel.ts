/** Short label for header / drawer (prefer name from metadata, else truncated email). */
export function profileDisplayLabel(user: {
  email?: string | null
  user_metadata?: { full_name?: string; name?: string }
} | null): string {
  if (!user) return 'Home'
  const metaName = user.user_metadata?.full_name || user.user_metadata?.name
  if (metaName && String(metaName).trim()) return String(metaName).trim()
  const email = user.email
  if (!email) return 'Profile'
  const [local] = email.split('@')
  if (local && local.length > 28) return `${local.slice(0, 26)}…`
  return email
}

/** Full email for drawer identity strip (eBay-style). Truncates very long addresses. */
export function profileEmailLabel(user: { email?: string | null } | null): string {
  if (!user?.email?.trim()) return 'Profile'
  const email = user.email.trim()
  if (email.length > 42) return `${email.slice(0, 40)}…`
  return email
}
