/**
 * Engagement Tracking Hook
 * Tracks user session duration, post views, and video engagement
 * for investor analytics
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase'

interface SessionMetrics {
  sessionId: string | null
  postsViewed: number
  postsCompleted: number
  videosWatched: number
  totalWatchTime: number
  interactions: number
}

interface PostViewMetrics {
  viewId: string | null
  slidesViewed: number
  totalSlides: number
  videoWatchSeconds: number
  startTime: Date | null
}

interface UseEngagementTrackingReturn {
  // Session methods
  startSession: (entryPage: string) => Promise<void>
  endSession: (exitPage?: string, reason?: string) => Promise<void>
  
  // Post view methods
  startPostView: (postId: string, totalSlides: number, wasClicked?: boolean) => Promise<void>
  updatePostView: (slidesViewed: number, videoWatchSeconds?: number) => Promise<void>
  endPostView: (exitMethod?: string) => Promise<void>
  
  // Event tracking
  trackEvent: (eventType: string, postId?: string, eventData?: any) => Promise<void>
  
  // Session state
  sessionMetrics: SessionMetrics
  currentPostView: PostViewMetrics
  isTracking: boolean
}

export function useEngagementTracking(
  userId?: string
): UseEngagementTrackingReturn {
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>({
    sessionId: null,
    postsViewed: 0,
    postsCompleted: 0,
    videosWatched: 0,
    totalWatchTime: 0,
    interactions: 0,
  })
  
  const [currentPostView, setCurrentPostView] = useState<PostViewMetrics>({
    viewId: null,
    slidesViewed: 0,
    totalSlides: 0,
    videoWatchSeconds: 0,
    startTime: null,
  })
  
  const [isTracking, setIsTracking] = useState(false)
  const sessionStartTime = useRef<Date | null>(null)
  const currentPostId = useRef<string | null>(null)
  
  // Detect device type
  const getDeviceType = (): string => {
    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }
  
  // Get browser info
  const getBrowserInfo = (): string => {
    const ua = navigator.userAgent
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Safari')) return 'Safari'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Edge')) return 'Edge'
    return 'Other'
  }
  
  // Start session
  const startSession = useCallback(async (entryPage: string) => {
    if (!userId || sessionMetrics.sessionId) {
      console.log('⏭️ Session already active or no user')
      return
    }
    
    try {
      console.log('🚀 Starting engagement session:', { userId, entryPage })
      
      const { data, error } = await supabase
        .rpc('start_user_session', {
          p_user_id: userId,
          p_entry_page: entryPage,
          p_user_agent: navigator.userAgent,
          p_device_type: getDeviceType()
        })
      
      if (error) throw error
      
      const sessionId = data as string
      
      setSessionMetrics(prev => ({
        ...prev,
        sessionId
      }))
      
      sessionStartTime.current = new Date()
      setIsTracking(true)
      
      console.log('✅ Session started:', sessionId)
    } catch (error) {
      console.error('❌ Error starting session:', error)
    }
  }, [userId, sessionMetrics.sessionId])
  
  // End session
  const endSession = useCallback(async (
    exitPage?: string,
    reason: string = 'user_logout'
  ) => {
    if (!sessionMetrics.sessionId) return
    
    try {
      console.log('🛑 Ending engagement session:', sessionMetrics.sessionId)
      
      await supabase.rpc('end_user_session', {
        p_session_id: sessionMetrics.sessionId,
        p_exit_page: exitPage,
        p_end_reason: reason
      })
      
      setSessionMetrics({
        sessionId: null,
        postsViewed: 0,
        postsCompleted: 0,
        videosWatched: 0,
        totalWatchTime: 0,
        interactions: 0,
      })
      
      setIsTracking(false)
      sessionStartTime.current = null
      
      console.log('✅ Session ended')
    } catch (error) {
      console.error('❌ Error ending session:', error)
    }
  }, [sessionMetrics.sessionId])
  
  // Start post view
  const startPostView = useCallback(async (
    postId: string,
    totalSlides: number,
    wasClicked: boolean = false
  ) => {
    if (!userId || !sessionMetrics.sessionId) {
      console.log('⏭️ Cannot start post view: no session')
      return
    }
    
    // End previous post view if exists
    if (currentPostView.viewId) {
      await endPostView('scroll_away')
    }
    
    try {
      console.log('👁️ Starting post view:', { postId, totalSlides, wasClicked })
      
      const { data, error } = await supabase
        .rpc('start_post_view', {
          p_user_id: userId,
          p_post_id: postId,
          p_session_id: sessionMetrics.sessionId,
          p_total_slides: totalSlides,
          p_was_clicked: wasClicked
        })
      
      if (error) throw error
      
      const viewId = data as string
      
      setCurrentPostView({
        viewId,
        slidesViewed: 0,
        totalSlides,
        videoWatchSeconds: 0,
        startTime: new Date()
      })
      
      currentPostId.current = postId
      
      setSessionMetrics(prev => ({
        ...prev,
        postsViewed: prev.postsViewed + 1
      }))
      
      console.log('✅ Post view started:', viewId)
    } catch (error) {
      console.error('❌ Error starting post view:', error)
    }
  }, [userId, sessionMetrics.sessionId, currentPostView.viewId])
  
  // Update post view progress
  const updatePostView = useCallback(async (
    slidesViewed: number,
    videoWatchSeconds: number = 0
  ) => {
    if (!currentPostView.viewId) return
    
    try {
      await supabase.rpc('update_post_view_progress', {
        p_view_id: currentPostView.viewId,
        p_slides_viewed: slidesViewed,
        p_video_watch_seconds: videoWatchSeconds
      })
      
      setCurrentPostView(prev => ({
        ...prev,
        slidesViewed: Math.max(prev.slidesViewed, slidesViewed),
        videoWatchSeconds: prev.videoWatchSeconds + videoWatchSeconds
      }))
      
      if (videoWatchSeconds > 0) {
        setSessionMetrics(prev => ({
          ...prev,
          videosWatched: prev.videosWatched + 1,
          totalWatchTime: prev.totalWatchTime + videoWatchSeconds
        }))
      }
    } catch (error) {
      console.error('❌ Error updating post view:', error)
    }
  }, [currentPostView.viewId])
  
  // End post view
  const endPostView = useCallback(async (exitMethod: string = 'unknown') => {
    if (!currentPostView.viewId) return
    
    try {
      console.log('👋 Ending post view:', currentPostView.viewId)
      
      await supabase.rpc('end_post_view', {
        p_view_id: currentPostView.viewId,
        p_exit_method: exitMethod
      })
      
      // Check if completed (>=80% of slides)
      const completionRate = currentPostView.totalSlides > 0 
        ? (currentPostView.slidesViewed / currentPostView.totalSlides) * 100
        : 0
      
      if (completionRate >= 80) {
        setSessionMetrics(prev => ({
          ...prev,
          postsCompleted: prev.postsCompleted + 1
        }))
      }
      
      setCurrentPostView({
        viewId: null,
        slidesViewed: 0,
        totalSlides: 0,
        videoWatchSeconds: 0,
        startTime: null
      })
      
      currentPostId.current = null
      
      console.log('✅ Post view ended')
    } catch (error) {
      console.error('❌ Error ending post view:', error)
    }
  }, [currentPostView])
  
  // Track generic event
  const trackEvent = useCallback(async (
    eventType: string,
    postId?: string,
    eventData?: any
  ) => {
    if (!userId || !sessionMetrics.sessionId) return
    
    try {
      await supabase.from('engagement_events').insert({
        user_id: userId,
        session_id: sessionMetrics.sessionId,
        post_view_id: currentPostView.viewId,
        event_type: eventType,
        post_id: postId || currentPostId.current,
        event_data: eventData,
        event_timestamp: new Date().toISOString()
      })
      
      // Track interactions
      if (['post_interaction', 'video_complete'].includes(eventType)) {
        setSessionMetrics(prev => ({
          ...prev,
          interactions: prev.interactions + 1
        }))
      }
    } catch (error) {
      console.error('❌ Error tracking event:', error)
    }
  }, [userId, sessionMetrics.sessionId, currentPostView.viewId])
  
  // Auto-end session on unmount or page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionMetrics.sessionId) {
        // User switched tabs/minimized - end session
        endSession(window.location.pathname, 'navigation_away')
      }
    }
    
    const handleBeforeUnload = () => {
      if (sessionMetrics.sessionId) {
        // Use sendBeacon for reliable end-of-session tracking
        const data = new FormData()
        data.append('session_id', sessionMetrics.sessionId)
        data.append('exit_page', window.location.pathname)
        data.append('end_reason', 'browser_close')
        
        // This is non-blocking and will complete even if page closes
        navigator.sendBeacon('/api/end-session', data)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      
      // End session on unmount
      if (sessionMetrics.sessionId) {
        endSession(window.location.pathname, 'navigation_away')
      }
    }
  }, [sessionMetrics.sessionId, endSession])
  
  return {
    startSession,
    endSession,
    startPostView,
    updatePostView,
    endPostView,
    trackEvent,
    sessionMetrics,
    currentPostView,
    isTracking
  }
}

// Helper hook for tracking video progress
export function useVideoTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  onProgress?: (seconds: number) => void
) {
  const lastProgressRef = useRef(0)
  const watchedIntervalsRef = useRef<Set<number>>(new Set())
  
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    const handleTimeUpdate = () => {
      const currentTime = Math.floor(video.currentTime)
      const interval = Math.floor(currentTime / 5) // Track every 5 seconds
      
      // Only track new 5-second intervals
      if (!watchedIntervalsRef.current.has(interval)) {
        watchedIntervalsRef.current.add(interval)
        
        const watchedSeconds = watchedIntervalsRef.current.size * 5
        
        if (onProgress) {
          onProgress(watchedSeconds - lastProgressRef.current)
        }
        
        lastProgressRef.current = watchedSeconds
      }
    }
    
    const handleEnded = () => {
      // Reset for next video
      watchedIntervalsRef.current.clear()
      lastProgressRef.current = 0
    }
    
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [videoRef, onProgress])
}

