/**
 * Single “active” feed video at a time: feed card previews, post reel hero, etc.
 * Ids are opaque strings; use stable prefixes so callers don’t collide:
 * - `feed-thumb:${postId}` — grid thumbnail preview
 * - `post-reel:${postId}` — mobile story reel header
 * - `post-section:${postId}:${sectionId}` — inline story sections (optional)
 *
 * Pattern: call `requestPlay(id)` before `video.play()`. All other mounted videos
 * pause via `useFeedVideoSync` when `activeId !== id`.
 */
import { create } from 'zustand'

export type FeedVideoScope = 'feed' | 'post'

interface FeedVideoState {
  /** Which video id may play audio + playback (others should pause). */
  activeId: string | null
  /** Last scope used — optional guard so feed thumbs don’t fight post page. */
  scope: FeedVideoScope | null
  requestPlay: (id: string, scope?: FeedVideoScope) => void
  stop: (id: string) => void
  clearScope: (scope: FeedVideoScope) => void
}

export const useFeedVideoStore = create<FeedVideoState>((set, get) => ({
  activeId: null,
  scope: null,
  requestPlay: (id, scope = 'feed') =>
    set({
      activeId: id,
      scope,
    }),
  stop: (id) => {
    const { activeId } = get()
    if (activeId === id) set({ activeId: null, scope: null })
  },
  clearScope: (scope) => {
    const s = get()
    if (s.scope === scope) set({ activeId: null, scope: null })
  },
}))

export function feedThumbVideoId(postId: string): string {
  return `feed-thumb:${postId}`
}

export function postReelVideoId(postId: string): string {
  return `post-reel:${postId}`
}
