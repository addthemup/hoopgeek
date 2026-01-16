import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let initialLoadComplete = false
    
    console.log('useAuth: Getting initial session');
    
    // Get initial session - this will restore from localStorage if available
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return
      
      if (error) {
        console.error('useAuth: Error getting session:', error);
        setSession(null)
        setUser(null)
        setLoading(false)
        initialLoadComplete = true
        return
      }
      
      // If session exists but token might be expired, try to refresh it
      if (session) {
        const now = Math.floor(Date.now() / 1000)
        const expiresAt = session.expires_at || 0
        
        // If token expires in less than 5 minutes OR is already expired, refresh it
        if (expiresAt - now < 300) {
          console.log('useAuth: Token expiring soon or expired, refreshing...', { expiresAt, now, diff: expiresAt - now });
          try {
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
            
            if (!mounted) return
            
            if (refreshError) {
              console.error('useAuth: Error refreshing session:', refreshError);
              // Only clear session if refresh token is invalid/expired
              // Don't clear on network errors - keep the session and let auto-refresh handle it
              if (refreshError.message?.includes('refresh_token') || refreshError.message?.includes('expired')) {
                setSession(null)
                setUser(null)
              } else {
                // Network error or other issue - keep existing session
                setSession(session)
                setUser(session.user)
              }
              setLoading(false)
              initialLoadComplete = true
              return
            }
            
            if (refreshedSession) {
              console.log('useAuth: Session refreshed successfully');
              setSession(refreshedSession)
              setUser(refreshedSession.user)
              setLoading(false)
              initialLoadComplete = true
              return
            }
          } catch (refreshException) {
            console.error('useAuth: Exception during refresh:', refreshException);
            if (mounted) {
              // On exception, keep the existing session
              setSession(session)
              setUser(session.user)
              setLoading(false)
              initialLoadComplete = true
            }
            return
          }
        }
      }
      
      if (mounted) {
        console.log('useAuth: Initial session:', { session, user: session?.user });
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        initialLoadComplete = true
      }
    }).catch((error) => {
      console.error('useAuth: Exception getting session:', error);
      if (mounted) {
        setSession(null)
        setUser(null)
        setLoading(false)
        initialLoadComplete = true
      }
    })

    // Listen for auth changes (including token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      console.log('useAuth: Auth state change:', { event, session, user: session?.user });
      
      // Handle token refresh events
      if (event === 'TOKEN_REFRESHED' && session) {
        console.log('useAuth: Token refreshed successfully via listener');
        setSession(session)
        setUser(session.user)
        // Don't set loading to false here if initial load isn't complete
        if (initialLoadComplete) {
          setLoading(false)
        }
        return
      }
      
      // Handle sign out events
      if (event === 'SIGNED_OUT') {
        console.log('useAuth: User signed out');
        setSession(null)
        setUser(null)
        if (initialLoadComplete) {
          setLoading(false)
        }
        return
      }
      
      // Handle sign in events
      if (event === 'SIGNED_IN' && session) {
        console.log('useAuth: User signed in');
        setSession(session)
        setUser(session.user)
        if (initialLoadComplete) {
          setLoading(false)
        }
        return
      }
      
      // For other events, update session but only set loading if initial load is complete
      setSession(session)
      setUser(session?.user ?? null)
      if (initialLoadComplete) {
        setLoading(false)
      }
    })

    // Periodic session check to ensure tokens stay fresh
    // Check every 5 minutes if session needs refresh
    const sessionCheckInterval = setInterval(async () => {
      if (!mounted) return
      
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (currentSession) {
          const now = Math.floor(Date.now() / 1000)
          const expiresAt = currentSession.expires_at || 0
          
          // If token expires in less than 5 minutes, refresh it
          if (expiresAt - now < 300) {
            console.log('useAuth: Periodic check - token expiring soon, refreshing...');
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
            
            if (!mounted) return
            
            if (!refreshError && refreshedSession) {
              console.log('useAuth: Periodic refresh successful');
              setSession(refreshedSession)
              setUser(refreshedSession.user)
            } else if (refreshError) {
              console.error('useAuth: Periodic refresh error:', refreshError);
              // Only clear if refresh token is truly invalid
              if (refreshError.message?.includes('refresh_token') || refreshError.message?.includes('expired')) {
                setSession(null)
                setUser(null)
              }
            }
          }
        }
      } catch (error) {
        console.error('useAuth: Error in periodic session check:', error);
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearInterval(sessionCheckInterval)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email)
    return { data, error }
  }

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}
