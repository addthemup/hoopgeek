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
    const { post_id, page_id } = body

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

    // Get Facebook credentials from environment variables
    const facebookPageAccessToken = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')
    const facebookPageId = page_id || Deno.env.get('FACEBOOK_PAGE_ID')

    if (!facebookPageAccessToken || !facebookPageId) {
      return new Response(
        JSON.stringify({ 
          error: 'Facebook credentials not configured',
          message: 'Please set FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare post content
    const baseUrl = Deno.env.get('SITE_URL') || 'https://hoopgeek.app'
    const postUrl = `${baseUrl}/${post.id}`
    const message = post.description || post.title || 'NBA Game Highlights'
    const link = postUrl

    // Post to Facebook Page using Graph API
    const graphApiUrl = `https://graph.facebook.com/v18.0/${facebookPageId}/feed`
    const postResponse = await fetch(graphApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        link: link,
        access_token: facebookPageAccessToken
      })
    })

    if (!postResponse.ok) {
      const errorText = await postResponse.text()
      console.error('Facebook post error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to post to Facebook', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const postData = await postResponse.json()
    
    // Update post metadata to track Facebook post
    await supabase
      .from('feed_posts')
      .update({
        metadata: {
          ...(post.metadata || {}),
          facebook_post_id: postData.id,
          facebook_post_url: `https://facebook.com/${postData.id}`,
          posted_to_facebook_at: new Date().toISOString()
        }
      })
      .eq('id', post_id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        facebook_post_id: postData.id,
        facebook_post_url: `https://facebook.com/${postData.id}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error posting to Facebook:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

