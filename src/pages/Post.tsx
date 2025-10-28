import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, CircularProgress, Typography, IconButton } from '@mui/joy'
import ArrowBack from '@mui/icons-material/ArrowBack'
import { supabase } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import { GameData } from '../utils/gameLoader'

// Import the GameCard component from Highlights
// We'll extract it to a shared component, but for now we'll fetch and display inline
export default function Post() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [post, setPost] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (postId) {
      loadPost()
    }
  }, [postId])

  const loadPost = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('feed_content')
        .select('*')
        .eq('id', postId)
        .single()

      if (error) throw error

      if (!data) {
        setError('Post not found')
        return
      }

      setPost(data as GameData)
    } catch (err: any) {
      console.error('Error loading post:', err)
      setError(err.message || 'Failed to load post')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
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

  if (error || !post) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        gap: 2
      }}>
        <Typography level="h3">😕 Post Not Found</Typography>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          {error || 'This post may have been removed or the link is incorrect.'}
        </Typography>
        <IconButton
          variant="solid"
          color="primary"
          onClick={() => navigate('/highlights')}
          sx={{ mt: 2 }}
        >
          <ArrowBack sx={{ mr: 1 }} />
          Back to Highlights
        </IconButton>
      </Box>
    )
  }

  // Render the post in a centered, Instagram-style layout
  return (
    <Box sx={{ 
      minHeight: '100vh',
      backgroundColor: 'background.level1',
      py: 2
    }}>
      {/* Back button */}
      <Box sx={{ 
        maxWidth: 900, 
        mx: 'auto', 
        px: 2,
        mb: 2
      }}>
        <IconButton
          variant="plain"
          onClick={() => navigate('/highlights')}
        >
          <ArrowBack />
        </IconButton>
      </Box>

      {/* Centered post */}
      <Box sx={{ 
        maxWidth: 900, 
        mx: 'auto', 
        px: { xs: 1, md: 2 }
      }}>
        {/* We'll import the actual GameCard component */}
        {/* For now, redirect to highlights with a message */}
        <Typography>Post ID: {postId}</Typography>
        <Typography>Content Type: {post.content_type}</Typography>
        <Typography>Game ID: {post.game_id}</Typography>
      </Box>
    </Box>
  )
}

