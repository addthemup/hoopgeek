/**
 * PostCreator utilities — slug generation, formatting helpers, source_ref builder.
 */

import type { PostType } from '../../../types/feed'

export function generateSlug(title: string, gameDate?: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const datePart = gameDate || new Date().toISOString().slice(0, 10)
  const random = Math.random().toString(36).slice(2, 6)
  return `${base}${datePart ? '-' + datePart : ''}-${random}`
}

/**
 * Builds a unique source_ref for dedup. Include a disambiguator when multiple posts
 * can share the same type+game or type+date (e.g. player_spotlight per player, player_of_week East vs West).
 */
export function generateSourceRef(
  postType: PostType,
  gameId?: string,
  gameDate?: string,
  disambiguator?: string | number | null
): string {
  const base = gameId ? `${postType}:${gameId}` : gameDate ? `${postType}:${gameDate}` : `${postType}:${Date.now()}`
  if (disambiguator != null && disambiguator !== '') {
    const safe = String(disambiguator).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    return `${base}:${safe}`
  }
  return base
}

export function formatSalary(salary: number): string {
  if (salary >= 1_000_000) return `$${(salary / 1_000_000).toFixed(1)}M`
  if (salary >= 1_000) return `$${(salary / 1_000).toFixed(0)}K`
  return `$${salary}`
}

let _idCounter = 0
export function nextSectionId(): string {
  return `auto-${_idCounter++}-${Math.random().toString(36).slice(2, 6)}`
}
export function resetSectionIdCounter(): void {
  _idCounter = 0
}

/**
 * Parse inline post links from markdown.
 * Syntax: `{{post:/feed/slug|Display Text}}`
 * Returns array of { slug, displayText } found in the string.
 */
export function parsePostLinks(markdown: string): Array<{ slug: string; displayText: string }> {
  const regex = /\{\{post:\/feed\/([^\s|]+)\|([^}]+)\}\}/g
  const links: Array<{ slug: string; displayText: string }> = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(markdown)) !== null) {
    links.push({ slug: match[1], displayText: match[2] })
  }
  return links
}

/**
 * Insert a post link into markdown at a cursor position.
 * Returns the new markdown string with the link inserted.
 */
export function insertPostLink(markdown: string, cursorPos: number, slug: string, displayText: string): string {
  const link = `{{post:/feed/${slug}|${displayText}}}`
  return markdown.slice(0, cursorPos) + link + markdown.slice(cursorPos)
}

/**
 * Convert post link syntax to renderable HTML.
 * `{{post:/feed/slug|Display Text}}` → `<a href="/feed/slug" class="post-link">Display Text</a>`
 */
export function renderPostLinks(markdown: string): string {
  return markdown.replace(
    /\{\{post:\/feed\/([^\s|]+)\|([^}]+)\}\}/g,
    '<a href="/feed/$1" class="post-link" data-post-link="$1">$2</a>'
  )
}
