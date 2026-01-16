import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { post_id, subreddit = 'hoopgeek' } = body

    if (!post_id) {
      return new Response(
        JSON.stringify({ error: 'post_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch post data from database
    const { data: post, error: postError } = await supabase
      .from('feed_posts')
      .select('*')
      .eq('id', post_id)
      .single()

    if (postError || !post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Reddit credentials from environment variables
    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID')
    const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')
    const redditUsername = Deno.env.get('REDDIT_USERNAME')
    const redditPassword = Deno.env.get('REDDIT_PASSWORD')
    const redditUserAgent = Deno.env.get('REDDIT_USER_AGENT') || 'HoopGeek/1.0'

    if (!redditClientId || !redditClientSecret || !redditUsername || !redditPassword) {
      return new Response(
        JSON.stringify({ 
          error: 'Reddit credentials not configured',
          message: 'Please set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, and REDDIT_PASSWORD environment variables'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Get Reddit OAuth token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${redditClientId}:${redditClientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': redditUserAgent
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: redditUsername,
        password: redditPassword
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Reddit token error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with Reddit', details: errorText }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Step 2: Prepare post content
    const baseUrl = Deno.env.get('SITE_URL') || 'https://hoopgeek.app'
    const postUrl = `${baseUrl}/${post.id}`
    const title = post.title || 'NBA Game Highlights'
    const description = post.description || ''
    const text = `${description}\n\n${postUrl}`

    // Step 3: Submit post to Reddit
    const submitResponse = await fetch(`https://oauth.reddit.com/r/${subreddit}/api/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': redditUserAgent
      },
      body: new URLSearchParams({
        kind: 'self',
        sr: subreddit,
        title: title,
        text: text
      })
    })

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text()
      console.error('Reddit submit error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to post to Reddit', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const submitData = await submitResponse.json()
    
    // Update post metadata to track Reddit post
    await supabase
      .from('feed_posts')
      .update({
        metadata: {
          ...(post.metadata || {}),
          reddit_post_id: submitData.json?.data?.id,
          reddit_post_url: `https://reddit.com${submitData.json?.data?.permalink}`,
          posted_to_reddit_at: new Date().toISOString()
        }
      })
      .eq('id', post_id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        reddit_post_id: submitData.json?.data?.id,
        reddit_post_url: `https://reddit.com${submitData.json?.data?.permalink}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error posting to Reddit:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

