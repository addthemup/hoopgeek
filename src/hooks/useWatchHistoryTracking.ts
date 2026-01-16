import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../utils/supabase'
import { useAuth } from './useAuth'

interface WatchHistoryEntry {
  postId: string
  slideIndex: number
  teamTricode: string | null
  playerId: number | null
  watchSeconds: number
  videoWatchSeconds: number
  postType: string | null
  gameId: string | null
}

interface UseWatchHistoryTrackingReturn {
  startTracking: (postId: string, slideIndex: number, slide: any, post: any) => void
  stopTracking: () => void
  updateVideoTime: (seconds: number) => void
  flushPendingUpdates: () => Promise<void>
}

/**
 * Hook for tracking watch history per team and player
 * 
 * Features:
 * - Lightweight React state tracking (no performance impact)
 * - Batched database updates (every 5 seconds or on slide change)
 * - Extracts team/player info from posts and slides automatically
 * - Handles multiple teams/players per slide
 */
export function useWatchHistoryTracking(): UseWatchHistoryTrackingReturn {
  const { user } = useAuth()
  const [currentEntry, setCurrentEntry] = useState<WatchHistoryEntry | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<WatchHistoryEntry[]>([])
  
  const startTimeRef = useRef<number | null>(null)
  const videoTimeRef = useRef<number>(0)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Extract team/player info from slide and post
  const extractContentInfo = useCallback((slide: any, post: any) => {
    const teams: string[] = []
    const players: number[] = []

    // Get teams from post
    if (post?.team_tricodes && Array.isArray(post.team_tricodes)) {
      teams.push(...post.team_tricodes.filter(Boolean))
    }

    // Get players from post
    if (post?.player_ids && Array.isArray(post.player_ids)) {
      players.push(...post.player_ids.filter(Boolean))
    }
    if (post?.person_id) {
      players.push(post.person_id)
    }

    // Get team/player from slide metadata
    if (slide?.metadata) {
      if (slide.metadata.teamTricode) {
        teams.push(slide.metadata.teamTricode)
      }
      if (slide.metadata.personId) {
        players.push(slide.metadata.personId)
      }
    }

    // Get team/player from slide directly (for chart slides)
    if (slide?.teamTricode) {
      teams.push(slide.teamTricode)
    }
    if (slide?.playerId) {
      players.push(slide.playerId)
    }

    // For top_fantasy_scorers charts, extract from players array
    if (slide?.type === 'top_fantasy_scorers' && slide.players && Array.isArray(slide.players)) {
      slide.players.forEach((player: any) => {
        if (player.teamTricode) teams.push(player.teamTricode)
        if (player.personId) players.push(player.personId)
      })
    }

    // Remove duplicates
    const uniqueTeams = Array.from(new Set(teams))
    const uniquePlayers = Array.from(new Set(players))

    return { teams: uniqueTeams, players: uniquePlayers }
  }, [])

  // FIXED: Use a ref to access currentEntry to prevent dependency issues
  const currentEntryRef = useRef<WatchHistoryEntry | null>(null)
  useEffect(() => {
    currentEntryRef.current = currentEntry
  }, [currentEntry])

  // Flush pending updates to database (defined early so it can be used by flushCurrentEntry)
  const flushPendingUpdates = useCallback(async () => {
    if (!user?.id || pendingUpdates.length === 0) return

    const updates = [...pendingUpdates]
    setPendingUpdates([])

    try {
      // Batch upsert all updates
      const promises = updates.map(entry => {
        if (!entry.teamTricode && !entry.playerId) return null

        return supabase.rpc('upsert_watch_history', {
          p_user_id: user.id,
          p_post_id: entry.postId,
          p_slide_index: entry.slideIndex,
          p_team_tricode: entry.teamTricode,
          p_player_id: entry.playerId,
          p_watch_seconds: entry.watchSeconds,
          p_video_watch_seconds: entry.videoWatchSeconds,
          p_post_type: entry.postType,
          p_game_id: entry.gameId
        })
      })

      await Promise.all(promises.filter(Boolean))
      
      console.log('✅ Flushed watch history updates:', updates.length)
    } catch (error) {
      console.error('❌ Error flushing watch history:', error)
      // Re-add failed updates to pending
      setPendingUpdates(prev => [...updates, ...prev])
    }
  }, [user?.id, pendingUpdates])

  // Flush current entry to pending updates
  // FIXED: Use ref to access currentEntry to prevent dependency issues
  // MUST be defined before stopTracking which uses it
  const flushCurrentEntry = useCallback(() => {
    const entry = currentEntryRef.current
    if (!entry || !startTimeRef.current) return

    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    if (elapsed <= 0) return

    const flushedEntry: WatchHistoryEntry = {
      ...entry,
      watchSeconds: elapsed,
      videoWatchSeconds: videoTimeRef.current
    }

    setPendingUpdates(prev => [...prev, flushedEntry])
    
    // Reset timer
    startTimeRef.current = Date.now()
    videoTimeRef.current = 0

    // Debounce database flush (wait 2 seconds for batching)
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
    }
    flushTimeoutRef.current = setTimeout(() => {
      flushPendingUpdates()
    }, 2000)
  }, [flushPendingUpdates]) // Only depend on flushPendingUpdates

  // Stop tracking current slide
  // FIXED: Removed currentEntry from dependencies to prevent infinite loops
  // Use a ref to access currentEntry instead
  const stopTracking = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
      updateIntervalRef.current = null
    }

    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }

    // Flush current entry before stopping - use ref to avoid dependency issues
    const entry = currentEntryRef.current
    if (entry && startTimeRef.current) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      if (elapsed > 0) {
        flushCurrentEntry()
      }
    }

    setCurrentEntry(null)
    startTimeRef.current = null
    videoTimeRef.current = 0
  }, [flushCurrentEntry]) // Only depend on flushCurrentEntry

  // Start tracking a slide
  const startTracking = useCallback((
    postId: string,
    slideIndex: number,
    slide: any,
    post: any
  ) => {
    if (!user?.id) return

    // Stop previous tracking if any
    stopTracking()

    const { teams, players } = extractContentInfo(slide, post)

    // If no teams or players, don't track
    if (teams.length === 0 && players.length === 0) {
      return
    }

    // For now, track the first team/player (we can expand to track all later)
    // This keeps it simple and performant
    const teamTricode = teams[0] || null
    const playerId = players[0] || null

    const entry: WatchHistoryEntry = {
      postId,
      slideIndex,
      teamTricode,
      playerId,
      watchSeconds: 0,
      videoWatchSeconds: 0,
      postType: post?.post_type || null,
      gameId: post?.game_id || null
    }

    setCurrentEntry(entry)
    startTimeRef.current = Date.now()
    videoTimeRef.current = 0

    // Set up periodic flush (every 5 seconds)
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
    }
    updateIntervalRef.current = setInterval(() => {
      flushCurrentEntry()
    }, 5000) // Flush every 5 seconds
  }, [user?.id, extractContentInfo, stopTracking, flushCurrentEntry])


  // Update video watch time
  // FIXED: Use ref to access currentEntry to prevent dependency issues
  const updateVideoTime = useCallback((seconds: number) => {
    if (currentEntryRef.current && seconds > videoTimeRef.current) {
      videoTimeRef.current = seconds
    }
  }, []) // Empty deps - use refs to access current state


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking()
      flushPendingUpdates()
    }
  }, [stopTracking, flushPendingUpdates])

  // Flush on unmount or when component is about to unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use ref to access currentEntry to avoid dependency issues
      const entry = currentEntryRef.current
      if (entry && startTimeRef.current) {
        flushCurrentEntry()
      }
      flushPendingUpdates()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [flushCurrentEntry, flushPendingUpdates]) // Removed currentEntry - use ref instead

  return {
    startTracking,
    stopTracking,
    updateVideoTime,
    flushPendingUpdates
  }
}

