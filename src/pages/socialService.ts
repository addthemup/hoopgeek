/**
 * Social Features Service
 * 
 * Handles likes, comments, and shares for the NBA highlights feed
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qbznyaimnrpibmahisue.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface Like {
  id: string
  content_id: string
  user_id: string
  created_at: string
}

export interface Comment {
  id: string
  content_id: string
  user_id: string
  username: string
  comment_text: string
  created_at: string
}

export interface Share {
  id: string
  content_id: string
  user_id: string
  platform: string
  created_at: string
}

export class SocialService {
  /**
   * Like or unlike a piece of content
   */
  static async toggleLike(contentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    try {
      // Check if user has already liked this content
      const { data: existingLike, error: checkError } = await supabase
        .from('feed_likes')
        .select('id')
        .eq('content_id', contentId)
        .eq('user_id', userId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingLike) {
        // Unlike: Remove the like
        const { error: deleteError } = await supabase
          .from('feed_likes')
          .delete()
          .eq('content_id', contentId)
          .eq('user_id', userId)

        if (deleteError) throw deleteError

        // Get updated likes count
        const { count } = await supabase
          .from('feed_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', contentId)

        return { liked: false, likesCount: count || 0 }
      } else {
        // Like: Add the like
        const { error: insertError } = await supabase
          .from('feed_likes')
          .insert({
            content_id: contentId,
            user_id: userId
          })

        if (insertError) throw insertError

        // Get updated likes count
        const { count } = await supabase
          .from('feed_likes')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', contentId)

        return { liked: true, likesCount: count || 0 }
      }
    } catch (error) {
      console.error('Error toggling like:', error)
      throw error
    }
  }

  /**
   * Add a comment to content
   */
  static async addComment(contentId: string, userId: string, username: string, commentText: string): Promise<Comment> {
    try {
      const { data, error } = await supabase
        .from('feed_comments')
        .insert({
          content_id: contentId,
          user_id: userId,
          username: username,
          comment_text: commentText
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding comment:', error)
      throw error
    }
  }

  /**
   * Get comments for content
   */
  static async getComments(contentId: string, limit: number = 10): Promise<Comment[]> {
    try {
      const { data, error } = await supabase
        .from('feed_comments')
        .select('*')
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching comments:', error)
      return []
    }
  }

  /**
   * Share content to a platform
   */
  static async shareContent(contentId: string, userId: string, platform: string): Promise<Share> {
    try {
      const { data, error } = await supabase
        .from('feed_shares')
        .insert({
          content_id: contentId,
          user_id: userId,
          platform: platform
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error sharing content:', error)
      throw error
    }
  }

  /**
   * Get engagement stats for content
   */
  static async getEngagementStats(contentId: string): Promise<{
    likesCount: number
    commentsCount: number
    sharesCount: number
    userLiked: boolean
  }> {
    try {
      // Get likes count
      const { count: likesCount } = await supabase
        .from('feed_likes')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', contentId)

      // Get comments count
      const { count: commentsCount } = await supabase
        .from('feed_comments')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', contentId)

      // Get shares count
      const { count: sharesCount } = await supabase
        .from('feed_shares')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', contentId)

      // Check if current user has liked (you'll need to pass userId)
      const userLiked = false // This would need to be implemented with actual user auth

      return {
        likesCount: likesCount || 0,
        commentsCount: commentsCount || 0,
        sharesCount: sharesCount || 0,
        userLiked
      }
    } catch (error) {
      console.error('Error fetching engagement stats:', error)
      return {
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        userLiked: false
      }
    }
  }

  /**
   * Share to external platforms (Twitter, Facebook, etc.)
   */
  static async shareToExternal(contentId: string, platform: 'twitter' | 'facebook' | 'copy'): Promise<void> {
    const baseUrl = window.location.origin
    const shareUrl = `${baseUrl}/game/${contentId}`
    const shareText = `Check out this epic NBA highlight! 🏀`

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank')
        break
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')
        break
      case 'copy':
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
        break
    }
  }
}
