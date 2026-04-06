/**
 * Social Features Service — Feed V2
 *
 * Uses the new feed_post_likes / feed_post_comments / feed_post_shares
 * tables. Engagement counters on feed_posts are kept in sync automatically
 * by database triggers — no manual incrementing needed.
 *
 * Product naming: "bookmark" in feed_post_bookmarks is the saved-post / favorite-post
 * action in the story UI. Legacy `feed_comments` (content_id) is separate from
 * threaded `feed_post_comments` on published posts — do not merge without a migration plan.
 */

import { supabase } from '../utils/supabase'
import type { FeedPost, FeedPostComment, SharePlatform } from '../types/feed'

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

/** Saved posts for the profile hub (newest first). */
export async function listBookmarkedPosts(userId: string, limit = 50): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('feed_post_bookmarks')
    .select(
      `
      created_at,
      feed_posts (*)
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  const rows = (data ?? []) as { feed_posts: FeedPost | null }[]
  return rows.map((r) => r.feed_posts).filter((p): p is FeedPost => p != null)
}

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

// ─── Friends + Messaging ────────────────────────────────────

export interface SocialUserRow {
  user_id: string
  display_name: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
  is_friend: boolean
  has_outgoing_request: boolean
  has_incoming_request: boolean
  is_following: boolean
}

export interface FriendRow {
  user_id: string
  display_name: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
  friendship_created_at: string
}

export interface FriendRequestRow {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  created_at: string
  responded_at: string | null
}

export async function searchUsersForSocial(query: string, limit = 20): Promise<SocialUserRow[]> {
  const { data, error } = await supabase.rpc('search_users_for_social', {
    p_query: query,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as SocialUserRow[]
}

export async function listMyFriends(): Promise<FriendRow[]> {
  const { data, error } = await supabase.rpc('list_my_friends')
  if (error) throw error
  return (data ?? []) as FriendRow[]
}

export async function listMyFriendRequests(): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, requester_id, addressee_id, status, created_at, responded_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FriendRequestRow[]
}

export async function sendFriendRequest(targetUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_target_user_id: targetUserId })
  if (error) throw error
  return (data as string | null) ?? null
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('respond_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  })
  if (error) throw error
  return String(data ?? requestId)
}

export async function cancelFriendRequest(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('cancel_friend_request', { p_request_id: requestId })
  if (error) throw error
  return String(data ?? requestId)
}

export async function followUser(targetUserId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser()
  const me = authData.user?.id
  if (!me) throw new Error('Must be logged in')
  const { error } = await supabase
    .from('user_follows')
    .upsert({ follower_id: me, followee_id: targetUserId }, { onConflict: 'follower_id,followee_id' })
  if (error) throw error
}

export async function unfollowUser(targetUserId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser()
  const me = authData.user?.id
  if (!me) throw new Error('Must be logged in')
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', me)
    .eq('followee_id', targetUserId)
  if (error) throw error
}

export async function createOrGetDirectConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_or_get_direct_conversation', { p_other_user_id: otherUserId })
  if (error) throw error
  return String(data)
}

export async function sendConversationMessage(conversationId: string, body: string): Promise<void> {
  const trimmed = body.trim()
  if (!trimmed) return
  const { data: authData } = await supabase.auth.getUser()
  const senderId = authData.user?.id
  if (!senderId) throw new Error('Must be logged in to send messages')
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
  if (error) throw error
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
}

export async function sendSlipToConversation(args: {
  conversationId: string
  shareToken: string
  slipSummary: string
}): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = origin ? `${origin}/slip/${args.shareToken}` : `/slip/${args.shareToken}`
  const content = `${args.slipSummary}\n${url}`.trim()
  await sendConversationMessage(args.conversationId, content)
}
