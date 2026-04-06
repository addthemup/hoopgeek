/**
 * Resolve the first MP4 URL for feed cards (metadata only — no sections fetch).
 * Admin/automation often stores `metadata.slides` with `{ type: 'video', video_url }`.
 */
import type { FeedPost, FeedPostSection, VideoCarouselContent, VideoClipContent, PlayerHighlightContent } from '../types/feed'

function parseMeta(post: FeedPost): Record<string, unknown> {
  const raw = post.metadata
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}')
    } catch {
      return {}
    }
  }
  return (raw || {}) as Record<string, unknown>
}

export function getFirstMp4FromPostMetadata(post: FeedPost): string | null {
  const meta = parseMeta(post)
  const slides = meta.slides
  if (Array.isArray(slides)) {
    for (const s of slides) {
      const row = s as Record<string, unknown>
      if (row?.type === 'video' && typeof row.video_url === 'string') return row.video_url
      if (typeof row.video_url === 'string' && /\.mp4(\?|$)/i.test(row.video_url)) return row.video_url
      if (typeof row.mp4 === 'string') return row.mp4
    }
  }
  if (typeof meta.preview_mp4 === 'string') return meta.preview_mp4
  if (typeof meta.hero_mp4 === 'string') return meta.hero_mp4
  return null
}

/** All MP4 URLs from `metadata.slides` in order (for multi-slide story thumbnails). */
export function getMp4SlideUrlsFromMetadata(post: FeedPost): string[] {
  const meta = parseMeta(post)
  const slides = meta.slides
  if (!Array.isArray(slides)) return []
  const urls: string[] = []
  for (const s of slides) {
    const row = s as Record<string, unknown>
    const u =
      typeof row.video_url === 'string'
        ? row.video_url
        : typeof row.mp4 === 'string'
          ? row.mp4
          : null
    if (u && /\.mp4(\?|$)/i.test(u)) urls.push(u)
  }
  return urls
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

/**
 * First highlight MP4 in section order — for mobile reel hero and skipping duplicate inline players.
 * `urls` is every MP4 in that section (carousel / highlight clips) for reel slideshows.
 */
export function getReelVideoFromSections(sections: FeedPostSection[]): {
  url: string | null
  urls: string[]
  skipSectionId: string | null
} {
  for (const s of sections) {
    if (s.section_type === 'video_clip') {
      const c = s.content as VideoClipContent
      if (c?.video_url) {
        const urls = dedupeUrls([c.video_url])
        return { url: urls[0], urls, skipSectionId: s.id }
      }
    }
    if (s.section_type === 'video_carousel') {
      const c = s.content as VideoCarouselContent
      const urls = dedupeUrls((c?.clips ?? []).map((x) => x.mp4).filter(Boolean) as string[])
      if (urls.length) return { url: urls[0], urls, skipSectionId: s.id }
    }
    if (s.section_type === 'player_highlight') {
      const c = s.content as PlayerHighlightContent
      const fromClips = (c?.video_clips ?? []).map((x) => x.mp4).filter(Boolean) as string[]
      const urls = dedupeUrls([...(c?.video_url ? [c.video_url] : []), ...fromClips])
      if (urls.length) return { url: urls[0], urls, skipSectionId: s.id }
    }
  }
  return { url: null, urls: [], skipSectionId: null }
}
