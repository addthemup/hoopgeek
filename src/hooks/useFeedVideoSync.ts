import { useEffect, useRef, useCallback } from 'react'
import { useFeedVideoStore } from '../stores/feedVideoStore'

/**
 * Keeps a &lt;video&gt; in sync with the global feed video store: only `id` matching
 * `activeId` is allowed to stay playing; others pause.
 */
export function useFeedVideoSync(id: string) {
  const activeId = useFeedVideoStore((s) => s.activeId)
  const requestPlay = useFeedVideoStore((s) => s.requestPlay)
  const stop = useFeedVideoStore((s) => s.stop)
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (activeId !== id) {
      v.pause()
    }
  }, [activeId, id])

  const tryPlay = useCallback(
    (scope: Parameters<typeof requestPlay>[1]) => {
      requestPlay(id, scope)
      const v = ref.current
      if (v) v.play().catch(() => {})
    },
    [id, requestPlay]
  )

  return { ref, activeId, requestPlay, stop, tryPlay, isActive: activeId === id }
}
