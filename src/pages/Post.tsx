import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/joy'
import { supabase } from '../utils/supabase'

/**
 * Post route handler - renders post with OG meta tags for sharing
 * This allows sharing posts via URL like /:uuid
 * Validates UUID format to avoid conflicts with other routes
 */
export default function Post() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  // Helper function to set or update meta tag
  const setMetaTag = (property: string, content: string, isProperty = true) => {
    const selector = isProperty 
      ? `meta[property="${property}"]` 
      : `meta[name="${property}"]`
    let meta = document.querySelector(selector) as HTMLMetaElement
    if (!meta) {
      meta = document.createElement('meta')
      if (isProperty) {
        meta.setAttribute('property', property)
      } else {
        meta.setAttribute('name', property)
      }
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', content)
  }

  // Helper function to set or update link tag
  const setLinkTag = (rel: string, href: string) => {
    const selector = `link[rel="${rel}"]`
    let link = document.querySelector(selector) as HTMLLinkElement
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', rel)
      document.head.appendChild(link)
    }
    link.setAttribute('href', href)
  }

  // Helper function to set title
  const setTitle = (title: string) => {
    document.title = title
  }

  useEffect(() => {
    if (!uuid) {
      navigate('/', { replace: true })
      return
    }

    // Basic UUID format validation (contains dashes and is roughly the right length)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidPattern.test(uuid)) {
      // Not a valid UUID format, redirect to home
      navigate('/', { replace: true })
      return
    }

    // Fetch post data and set OG meta tags
    const fetchPostAndSetMeta = async () => {
      try {
        setIsLoading(true)
        const { data: post, error } = await supabase
          .from('feed_posts')
          .select('id, title, share_title, share_description, status, metadata')
          .eq('id', uuid)
          .eq('status', 'published')
          .maybeSingle()

        if (error) throw error

        if (!post) {
          // Post doesn't exist or isn't published, redirect to home
          navigate('/', { replace: true })
          return
        }

        // Post exists - set OG meta tags for sharing
        const baseUrl = window.location.origin
        const postUrl = `${baseUrl}/${uuid}`
        const ogImageUrl = `${baseUrl}/og-image/${uuid}`
        
        const title = post.share_title || post.title || 'NBA Highlights - HoopGeek'
        const description = post.share_description || post.title || 'Check out this NBA highlight on HoopGeek!'
        
        // Set OG meta tags
        setMetaTag('og:site_name', 'HoopGeek')
        setMetaTag('og:type', 'article')
        setMetaTag('og:title', title)
        setMetaTag('og:description', description)
        setMetaTag('og:image', ogImageUrl)
        setMetaTag('og:image:url', ogImageUrl)
        setMetaTag('og:image:secure_url', ogImageUrl)
        setMetaTag('og:image:type', 'image/png')
        setMetaTag('og:image:width', '1200')
        setMetaTag('og:image:height', '630')
        setMetaTag('og:image:alt', title)
        setMetaTag('og:url', postUrl)
        
        // Twitter Card meta tags
        setMetaTag('twitter:card', 'summary_large_image', false)
        setMetaTag('twitter:site', '@hoopgeek', false)
        setMetaTag('twitter:title', title, false)
        setMetaTag('twitter:description', description, false)
        setMetaTag('twitter:image', ogImageUrl, false)
        setMetaTag('twitter:image:alt', title, false)
        
        // Additional meta tags
        setMetaTag('description', description, false)
        setTitle(title)
        
        // Link rel="image_src" fallback
        setLinkTag('image_src', ogImageUrl)

        // Redirect to Highlights with postId query param
        // This will show the post in the feed
        // The URL will change to /?postId={uuid}, but the shared link is /{uuid} which works for bots
        navigate(`/?postId=${uuid}`, { replace: true })
      } catch (err) {
        console.error('Error fetching post:', err)
        navigate('/', { replace: true })
      } finally {
        setIsLoading(false)
      }
    }

    fetchPostAndSetMeta()
  }, [uuid, navigate])

  // Show loading while fetching and setting meta tags
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh' 
    }}>
      <CircularProgress size="lg" />
    </Box>
  )
}

