/**
 * Social Features Service — Feed V2
 *
 * Uses the new feed_post_likes / feed_post_comments / feed_post_shares
 * tables. Engagement counters on feed_posts are kept in sync automatically
 * by database triggers — no manual incrementing needed.
 */

import { supabase } from '../utils/supabase'
import type { FeedPostComment, SharePlatform } from '../types/feed'

// ─── Likes ──────────────────────────────────────────────────

export async function toggleLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likesCount: number }> {
  // Check if user has already liked this post
  const { data: existing, error: checkError } = await supabase
    .from('feed_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (checkError) throw checkError

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from('feed_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    // Like
    const { error } = await supabase
      .from('feed_post_likes')
      .insert({ post_id: postId, user_id: userId })
    if (error) throw error
  }

  // Read the denormalized counter (updated by trigger)
  const { data: post } = await supabase
    .from('feed_posts')
    .select('likes_count')
    .eq('id', postId)
    .single()

  return { liked: !existing, likesCount: post?.likes_count ?? 0 }
}

export async function hasUserLiked(postId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('feed_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// ─── Comments ───────────────────────────────────────────────

export async function addComment(
  postId: string,
  userId: string,
  content: string,
  parentCommentId?: string
): Promise<FeedPostComment> {
  const { data, error } = await supabase
    .from('feed_post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content,
      parent_comment_id: parentCommentId ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as FeedPostComment
}

export async function getComments(
  postId: string,
  limit = 50
): Promise<FeedPostComment[]> {
  // Fetch top-level comments, then nest replies client-side
  const { data, error } = await supabase
    .from('feed_post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  const comments = (data ?? []) as FeedPostComment[]

  // Build threaded tree
  const topLevel: FeedPostComment[] = []
  const byId = new Map<string, FeedPostComment>()
  for (const c of comments) {
    c.replies = []
    byId.set(c.id, c)
  }
  for (const c of comments) {
    if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
      byId.get(c.parent_comment_id)!.replies!.push(c)
    } else {
      topLevel.push(c)
    }
  }

  return topLevel
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('feed_post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)
  if (error) throw error
}

// ─── Shares ─────────────────────────────────────────────────

export async function recordShare(
  postId: string,
  userId: string | null,
  platform: SharePlatform
): Promise<void> {
  const { error } = await supabase
    .from('feed_post_shares')
    .insert({ post_id: postId, user_id: userId, platform })
  if (error) throw error
}

export async function shareToExternal(
  slug: string,
  platform: 'twitter' | 'facebook' | 'copy'
): Promise<void> {
  const shareUrl = `${window.location.origin}/feed/${slug}`

  switch (platform) {
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`, '_blank')
      break
    case 'facebook':
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')
      break
    case 'copy':
      await navigator.clipboard.writeText(shareUrl)
      break
  }
}

// ─── Bookmarks ──────────────────────────────────────────────

export async function toggleBookmark(
  postId: string,
  userId: string
): Promise<{ bookmarked: boolean; bookmarksCount: number }> {
  const { data: existing } = await supabase
    .from('feed_post_bookmarks')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('feed_post_bookmarks')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('feed_post_bookmarks')
      .insert({ post_id: postId, user_id: userId })
    if (error) throw error
  }

  const { data: post } = await supabase
    .from('feed_posts')
    .select('bookmarks_count')
    .eq('id', postId)
    .single()

  return { bookmarked: !existing, bookmarksCount: post?.bookmarks_count ?? 0 }
}

// ─── Views ──────────────────────────────────────────────────

export async function recordView(
  postId: string,
  userId: string | null,
  source: string = 'feed'
): Promise<void> {
  const { error } = await supabase
    .from('feed_post_views')
    .insert({
      post_id: postId,
      user_id: userId,
      source,
    })
  if (error) console.error('Error recording view:', error)
}

export async function updateViewDuration(
  viewId: string,
  durationSeconds: number,
  sectionsViewed: number
): Promise<void> {
  const { error } = await supabase
    .from('feed_post_views')
    .update({
      view_duration_seconds: durationSeconds,
      sections_viewed: sectionsViewed,
    })
    .eq('id', viewId)
  if (error) console.error('Error updating view duration:', error)
}

// ─── Engagement Stats (denormalized — single read) ──────────

export async function getEngagementStats(
  postId: string,
  userId?: string
): Promise<{
  likesCount: number
  commentsCount: number
  sharesCount: number
  viewsCount: number
  bookmarksCount: number
  userLiked: boolean
  userBookmarked: boolean
}> {
  // Read counters from the post itself (all maintained by triggers)
  const { data: post } = await supabase
    .from('feed_posts')
    .select('likes_count, comments_count, shares_count, views_count, bookmarks_count')
    .eq('id', postId)
    .single()

  let userLiked = false
  let userBookmarked = false

  if (userId) {
    const [likeCheck, bookmarkCheck] = await Promise.all([
      supabase.from('feed_post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
      supabase.from('feed_post_bookmarks').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
    ])
    userLiked = !!likeCheck.data
    userBookmarked = !!bookmarkCheck.data
  }

  return {
    likesCount: post?.likes_count ?? 0,
    commentsCount: post?.comments_count ?? 0,
    sharesCount: post?.shares_count ?? 0,
    viewsCount: post?.views_count ?? 0,
    bookmarksCount: post?.bookmarks_count ?? 0,
    userLiked,
    userBookmarked,
  }
}
