import { useEffect, useRef } from 'react'
import { useFeedVideoStore, feedThumbVideoId, type FeedVideoScope } from '../stores/feedVideoStore'

/**
 * Autoplay a feed-card preview video when the card is sufficiently visible.
 * Desktop grids can have multiple cards “visible”; higher threshold reduces overlap.
 */
export function useFeedThumbnailVideoAutoplay(
  postId: string,
  enabled: boolean,
  options: { rootMargin?: string; threshold?: number; scope?: FeedVideoScope } = {}
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const requestPlay = useFeedVideoStore((s) => s.requestPlay)
  const stop = useFeedVideoStore((s) => s.stop)
  const id = feedThumbVideoId(postId)
  const { rootMargin = '0px', threshold = 0.55, scope = 'feed' } = options

  useEffect(() => {
    if (!enabled) return
    const root = containerRef.current
    if (!root) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          requestPlay(id, scope)
          const vid = root.querySelector('video')
          vid?.play().catch(() => {})
        } else {
          stop(id)
          const vid = root.querySelector('video')
          vid?.pause()
        }
      },
      { threshold: [0, threshold, 1], rootMargin }
    )
    obs.observe(root)
    return () => {
      obs.disconnect()
      stop(id)
    }
  }, [enabled, id, requestPlay, stop, rootMargin, threshold, scope])

  return containerRef
}
