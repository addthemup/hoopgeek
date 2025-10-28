import { useState, useRef } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  Sheet,
  Chip,
  Modal,
  ModalDialog,
  ModalClose,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Option,
  Grid,
  AspectRatio,
  Stepper,
  Step,
  StepIndicator,
  StepButton,
  Snackbar
} from '@mui/joy'
import {
  Add,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  Upload,
  Save,
  Cancel,
  PlayArrow,
  Image as ImageIcon,
  BarChart,
  Person,
  Sports,
  EmojiEvents
} from '@mui/icons-material'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'
import FunScoreDataModal from './FunScoreDataModal'

interface FeedPost {
  id: string
  post_type: string
  status: string
  title?: string
  description?: string
  game_id?: string
  game_date?: string
  team_tricodes?: string[]
  slides: any[]
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  created_at: string
  published_at?: string
}

interface GameData {
  gameId: string
  gameMetadata: {
    date: string
    arena: string
    season: string
    homeTeam: {
      team_id: number
      abbreviation: string
      city: string
      name: string
      quarters: number[]
      points: number | null
    }
    awayTeam: {
      team_id: number
      abbreviation: string
      city: string
      name: string
      quarters: number[]
      points: number | null
    }
  }
  score: {
    [gameId: string]: {
      team_stats: any
      lead_changes: {
        total: number
        last_5_minutes: number
        last_minute: number
        buzzer_beater: number
      }
      dunk_stats: {
        [key: string]: number
        'Total Dunks': number
      }
      deep_shots: {
        deep_threes: number
        four_pointers: number
      }
      scoring_milestones: any
      fun_score: number
    }
  }
  story: {
    matchup: string
    final_score: string
    advantages: Array<any>
    teams: {
      winner: any
      loser: any
    }
  }
  script: {
    total_plays: number
    video_script: Array<{
      gameId: string
      actionId: number
      period: number
      clock: string
      description: string
      teamId: number
      teamTricode: string
      scoreHome: string
      scoreAway: string
      videoAvailable: number
      actionType: string
      subType: string
      shotResult: string
      playerName: string
      playerNameI: string
      personId: number
      mp4?: string | null
      mp4_local?: string | null
    }>
  }
}

export default function FeedContentManager() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [showPostBuilder, setShowPostBuilder] = useState(false)
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null)
  const [uploadedGameData, setUploadedGameData] = useState<GameData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  
  // Stepper state
  const [activeStep, setActiveStep] = useState(0)
  const [showMetadataModal, setShowMetadataModal] = useState(false)
  const [existingPostsCount, setExistingPostsCount] = useState(0)
  
  // Fun Score modal state
  const [showFunScoreModal, setShowFunScoreModal] = useState(false)
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    color: 'success' | 'danger' | 'warning' | 'neutral'
  }>({
    open: false,
    message: '',
    color: 'neutral'
  })
  
  // Filter state
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all')
  const [selectedActionType, setSelectedActionType] = useState<string>('all')
  const [showOnlyWithVideo, setShowOnlyWithVideo] = useState(true)
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Post Builder State
  const [postForm, setPostForm] = useState({
    post_type: 'game_highlight',
    title: '',
    description: '',
    game_id: '',
    game_date: '',
    team_tricodes: [] as string[],
    slides: [] as any[],
    metadata: {} as any
  })

  // Load posts
  const loadPosts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('Error loading posts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Process JSON file
  const processJsonFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const gameData = JSON.parse(e.target?.result as string) as GameData
        setUploadedGameData(gameData)
        
        // Auto-populate form fields
        const firstScoreKey = Object.keys(gameData.score || {})[0]
        const scoreData = firstScoreKey ? gameData.score[firstScoreKey] : null
        
        // Extract team tricodes
        const teams = [
          gameData.gameMetadata?.homeTeam?.abbreviation,
          gameData.gameMetadata?.awayTeam?.abbreviation
        ].filter(Boolean)
        
        setPostForm(prev => ({
          ...prev,
          game_id: gameData.gameId || '',
          game_date: gameData.gameMetadata?.date || '',
          team_tricodes: teams,
          metadata: {
            ...prev.metadata,
            arena: gameData.gameMetadata?.arena,
            season: gameData.gameMetadata?.season,
            homeTeam: gameData.gameMetadata?.homeTeam,
            awayTeam: gameData.gameMetadata?.awayTeam,
            story_data: gameData.story,
            fun_data: scoreData,
            fun_score: scoreData?.fun_score
          }
        }))

        // Check existing posts for this game
        const { data: existingPosts } = await supabase
          .from('feed_posts')
          .select('id')
          .eq('game_id', gameData.gameId)
        
        setExistingPostsCount(existingPosts?.length || 0)

        // Show metadata modal
        setShowMetadataModal(true)
      } catch (error) {
        console.error('Error parsing JSON:', error)
        setSnackbar({
          open: true,
          message: 'Invalid JSON file. Please check the format.',
          color: 'danger'
        })
      }
    }
    reader.readAsText(file)
  }

  // Handle JSON file upload from input
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    if (uploadedGameData) {
      // Show confirmation if data already exists
      setPendingFile(file)
      setShowDiscardConfirm(true)
    } else {
      processJsonFile(file)
    }
  }

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const jsonFile = files.find(file => file.name.endsWith('.json'))

    if (!jsonFile) {
      setSnackbar({
        open: true,
        message: 'Please drop a JSON file',
        color: 'warning'
      })
      return
    }

    if (uploadedGameData) {
      // Show confirmation if data already exists
      setPendingFile(jsonFile)
      setShowDiscardConfirm(true)
    } else {
      processJsonFile(jsonFile)
    }
  }

  // Handle discard confirmation
  const handleDiscardAndLoad = () => {
    if (pendingFile) {
      processJsonFile(pendingFile)
      setPendingFile(null)
    }
    setShowDiscardConfirm(false)
  }

  const handleCancelDiscard = () => {
    setPendingFile(null)
    setShowDiscardConfirm(false)
  }

  // Add slide from uploaded game data
  const handleAddSlide = (slideType: string, playIndex?: number) => {
    if (!uploadedGameData) {
      setSnackbar({
        open: true,
        message: 'Please upload a game JSON file first',
        color: 'warning'
      })
      return
    }

    let newSlide: any = {
      type: slideType,
      order: postForm.slides.length
    }

    // Handle different slide types
    if (slideType === 'video' && playIndex !== undefined) {
      const play = uploadedGameData.script?.video_script[playIndex]
      if (play) {
        // Find the video (might be from this play or next play in sequence)
        const videoUrl = findVideoForPlay(play, playIndex)
        
        if (videoUrl) {
          newSlide = {
            ...newSlide,
            video_url: videoUrl,
            thumbnail_url: videoUrl.replace('.mp4', '_thumbnail.jpg'),
            caption: play.description,
            metadata: {
              period: play.period,
              clock: play.clock,
              actionType: play.actionType,
              subType: play.subType,
              playerName: play.playerName,
              playerNameI: play.playerNameI,
              personId: play.personId,
              teamTricode: play.teamTricode,
              scoreHome: play.scoreHome,
              scoreAway: play.scoreAway,
              shotResult: play.shotResult,
              isSequence: !play.mp4 // Mark if video is from next play
            }
          }
        }
      }
    } else if (slideType === 'game_summary') {
      newSlide = {
        ...newSlide,
        home_team: uploadedGameData.gameMetadata?.homeTeam,
        away_team: uploadedGameData.gameMetadata?.awayTeam,
        game_date: uploadedGameData.gameMetadata?.date,
        arena: uploadedGameData.gameMetadata?.arena,
        matchup: uploadedGameData.story?.matchup,
        final_score: uploadedGameData.story?.final_score
      }
    }

    setPostForm(prev => ({
      ...prev,
      slides: [...prev.slides, newSlide]
    }))
  }

  // Remove slide
  const handleRemoveSlide = (index: number) => {
    setPostForm(prev => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index).map((slide, i) => ({
        ...slide,
        order: i
      }))
    }))
  }

  // Move slide
  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const newSlides = [...postForm.slides]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newSlides.length) return
    
    ;[newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]]
    
    // Update order values
    newSlides.forEach((slide, i) => {
      slide.order = i
    })
    
    setPostForm(prev => ({ ...prev, slides: newSlides }))
  }

  // Extract player IDs and team tricodes from slides
  const extractTagsFromSlides = () => {
    const playerIds = new Set<number>()
    const teamTricodes = new Set<string>()
    
    postForm.slides.forEach(slide => {
      if (slide.metadata?.personId) {
        playerIds.add(slide.metadata.personId)
      }
      if (slide.metadata?.teamTricode) {
        teamTricodes.add(slide.metadata.teamTricode)
      }
    })
    
    return {
      player_ids: Array.from(playerIds),
      team_tricodes: Array.from(teamTricodes)
    }
  }

  // Save as draft
  const handleSaveDraft = async (createNew: boolean = false) => {
    if (!user) return
    
    try {
      const tags = extractTagsFromSlides()
      
      const postData = {
        created_by: user.id,
        post_type: postForm.post_type,
        status: 'draft',
        title: postForm.title,
        description: postForm.description,
        game_id: postForm.game_id || null,
        game_date: postForm.game_date || null,
        team_tricodes: tags.team_tricodes,
        player_ids: tags.player_ids,
        slides: postForm.slides,
        metadata: postForm.metadata
      }

      if (editingPost) {
        const { error } = await supabase
          .from('feed_posts')
          .update(postData)
          .eq('id', editingPost.id)
        
        if (error) throw error
        setSnackbar({
          open: true,
          message: 'Post updated as draft',
          color: 'success'
        })
      } else {
        const { error } = await supabase
          .from('feed_posts')
          .insert([postData])
        
        if (error) throw error
        setSnackbar({
          open: true,
          message: 'Post saved as draft',
          color: 'success'
        })
        setExistingPostsCount(prev => prev + 1)
      }

      loadPosts()
      
      if (createNew) {
        // Reset form but keep JSON loaded
        resetForm()
      } else {
        // Close modal and reset everything
        setShowPostBuilder(false)
        resetAll()
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      setSnackbar({
        open: true,
        message: 'Error saving draft',
        color: 'danger'
      })
    }
  }

  // Publish post
  const handlePublish = async (createNew: boolean = false) => {
    if (!user) return
    
    if (postForm.slides.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please add at least one slide before publishing',
        color: 'warning'
      })
      return
    }

    try {
      const tags = extractTagsFromSlides()
      
      const postData = {
        created_by: user.id,
        post_type: postForm.post_type,
        status: 'published',
        title: postForm.title,
        description: postForm.description,
        game_id: postForm.game_id || null,
        game_date: postForm.game_date || null,
        team_tricodes: tags.team_tricodes,
        player_ids: tags.player_ids,
        slides: postForm.slides,
        metadata: postForm.metadata,
        published_at: new Date().toISOString()
      }

      if (editingPost) {
        // Use the publish_post function
        const { error } = await supabase.rpc('publish_post', { 
          post_id: editingPost.id 
        })
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('feed_posts')
          .insert([postData])
        
        if (error) throw error
        setExistingPostsCount(prev => prev + 1)
      }

      setSnackbar({
        open: true,
        message: 'Post published successfully! 🎉',
        color: 'success'
      })
      loadPosts()
      
      if (createNew) {
        // Reset form but keep JSON loaded
        resetForm()
      } else {
        // Close modal and reset everything
        setShowPostBuilder(false)
        resetAll()
      }
    } catch (error: any) {
      console.error('Error publishing post:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error publishing post',
        color: 'danger'
      })
    }
  }

  // Reset form
  const resetForm = () => {
    setPostForm({
      post_type: 'game_highlight',
      title: '',
      description: '',
      game_id: uploadedGameData?.gameId || '',
      game_date: uploadedGameData?.gameMetadata?.date || '',
      team_tricodes: uploadedGameData ? [
        uploadedGameData.gameMetadata?.homeTeam?.abbreviation,
        uploadedGameData.gameMetadata?.awayTeam?.abbreviation
      ].filter(Boolean) : [],
      slides: [],
      metadata: uploadedGameData ? {
        arena: uploadedGameData.gameMetadata?.arena,
        season: uploadedGameData.gameMetadata?.season,
        homeTeam: uploadedGameData.gameMetadata?.homeTeam,
        awayTeam: uploadedGameData.gameMetadata?.awayTeam,
        story_data: uploadedGameData.story,
        fun_data: uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]],
        fun_score: uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]]?.fun_score
      } : {}
    })
    setEditingPost(null)
    setActiveStep(0)
  }
  
  const resetAll = () => {
    setPostForm({
      post_type: 'game_highlight',
      title: '',
      description: '',
      game_id: '',
      game_date: '',
      team_tricodes: [],
      slides: [],
      metadata: {}
    })
    setEditingPost(null)
    setUploadedGameData(null)
    setActiveStep(0)
    setExistingPostsCount(0)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Delete post
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      const { error } = await supabase
        .from('feed_posts')
        .delete()
        .eq('id', postId)

      if (error) throw error
      setSnackbar({
        open: true,
        message: 'Post deleted',
        color: 'success'
      })
      loadPosts()
    } catch (error) {
      console.error('Error deleting post:', error)
      setSnackbar({
        open: true,
        message: 'Error deleting post',
        color: 'danger'
      })
    }
  }

  // Edit post
  const handleEditPost = async (post: FeedPost) => {
    setEditingPost(post)
    setPostForm({
      post_type: post.post_type,
      title: post.title || '',
      description: post.description || '',
      game_id: post.game_id || '',
      game_date: post.game_date || '',
      team_tricodes: post.team_tricodes || [],
      slides: post.slides || [],
      metadata: {}
    })
    setShowPostBuilder(true)
  }

  // Extract unique players from game data
  const getUniquePlayers = () => {
    if (!uploadedGameData?.script?.video_script) return []
    
    const playersMap = new Map<string, { lastName: string, fullName: string, personId: number }>()
    
    uploadedGameData.script.video_script.forEach(play => {
      if (play.playerName && play.personId) {
        const key = `${play.personId}`
        if (!playersMap.has(key)) {
          // playerNameI is like "A. Nembhard", extract full name
          const fullName = play.playerNameI || play.playerName
          playersMap.set(key, {
            lastName: play.playerName,
            fullName: fullName,
            personId: play.personId
          })
        }
      }
      
      // Also check for assists in description
      const assistMatch = play.description.match(/\(([^)]+)\s+(\d+)\s+AST\)/)
      if (assistMatch) {
        const assistPlayerName = assistMatch[1]
        // Try to find the full player info
        const assistPlay = uploadedGameData.script.video_script.find(p => 
          p.playerName === assistPlayerName || p.playerNameI?.includes(assistPlayerName)
        )
        if (assistPlay && assistPlay.personId) {
          const key = `${assistPlay.personId}`
          if (!playersMap.has(key)) {
            playersMap.set(key, {
              lastName: assistPlay.playerName,
              fullName: assistPlay.playerNameI || assistPlay.playerName,
              personId: assistPlay.personId
            })
          }
        }
      }
    })
    
    return Array.from(playersMap.values())
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
  }
  
  // Extract unique action types
  const getUniqueActionTypes = () => {
    if (!uploadedGameData?.script?.video_script) return []
    
    const typesSet = new Set<string>()
    uploadedGameData.script.video_script.forEach(play => {
      if (play.actionType) {
        typesSet.add(play.actionType)
      }
    })
    
    return Array.from(typesSet).sort()
  }
  
  // Check if play involves selected player (as player or assister)
  const playInvolvesPlayer = (play: any, playerId: string) => {
    if (playerId === 'all') return true
    
    // Check if player is the main actor
    if (play.personId.toString() === playerId) return true
    
    // Check if player assisted
    const assistMatch = play.description.match(/\(([^)]+)\s+(\d+)\s+AST\)/)
    if (assistMatch) {
      const assistPlayerName = assistMatch[1]
      const assistPlay = uploadedGameData?.script?.video_script.find(p => 
        p.playerName === assistPlayerName || p.playerNameI?.includes(assistPlayerName)
      )
      if (assistPlay && assistPlay.personId.toString() === playerId) {
        return true
      }
    }
    
    return false
  }
  
  // Find the video for a play (might be in the next play if sequence)
  const findVideoForPlay = (play: any, index: number) => {
    if (play.mp4) return play.mp4
    
    // Look forward for the next play with video (within 20 seconds)
    const videoScript = uploadedGameData?.script?.video_script || []
    for (let i = index + 1; i < Math.min(index + 10, videoScript.length); i++) {
      const nextPlay = videoScript[i]
      if (nextPlay.mp4 && nextPlay.period === play.period) {
        // Check if within ~20 seconds
        const currentTime = parseClockToSeconds(play.clock)
        const nextTime = parseClockToSeconds(nextPlay.clock)
        if (currentTime - nextTime <= 20) {
          return nextPlay.mp4
        }
      }
    }
    
    return null
  }
  
  // Parse clock to seconds
  const parseClockToSeconds = (clock: string) => {
    try {
      const match = clock.match(/PT(\d+)M([\d.]+)S/)
      if (match) {
        const minutes = parseInt(match[1])
        const seconds = parseFloat(match[2])
        return minutes * 60 + seconds
      }
    } catch (e) {
      return 0
    }
    return 0
  }
  
  // Filter plays based on selections
  const getFilteredPlays = () => {
    if (!uploadedGameData?.script?.video_script) return []
    
    return uploadedGameData.script.video_script
      .map((play, index) => ({
        ...play,
        video: findVideoForPlay(play, index),
        originalIndex: index
      }))
      .filter(play => {
        // Filter by search query (description)
        if (searchQuery && !play.description.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false
        }
        
        // Filter by player
        if (!playInvolvesPlayer(play, selectedPlayer)) return false
        
        // Filter by action type
        if (selectedActionType !== 'all' && play.actionType !== selectedActionType) return false
        
        // Filter by video availability
        if (showOnlyWithVideo && !play.video) return false
        
        return true
      })
  }

  // Load posts on mount
  useState(() => {
    loadPosts()
  })

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography level="h3" startDecorator={<Sports />}>
            Feed Content Manager
          </Typography>
          <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
            Create and manage curated feed posts
          </Typography>
        </Box>
        <Button
          startDecorator={<Add />}
          onClick={() => {
            resetForm()
            setShowPostBuilder(true)
          }}
        >
          Create Post
        </Button>
      </Box>

      {/* Posts Table */}
      <Card variant="outlined">
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : posts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography level="body-lg" sx={{ mb: 2 }}>
                No posts yet
              </Typography>
              <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                Create your first curated feed post
              </Typography>
            </Box>
          ) : (
            <Sheet sx={{ overflow: 'auto' }}>
              <Table sx={{
                '& thead th': {
                  bgcolor: '#000',
                  color: '#fff',
                  fontFamily: 'serif',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  borderBottom: '3px solid #000',
                  fontSize: '0.85rem',
                  letterSpacing: '0.05em'
                },
                '& tbody td': {
                  borderBottom: '2px solid #000',
                  fontFamily: 'serif'
                },
                '& tbody tr:hover': {
                  bgcolor: '#f0f0f0'
                }
              }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Slides</th>
                    <th>Engagement</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <Typography level="title-sm">
                          {post.title || post.game_id || 'Untitled'}
                        </Typography>
                        {post.description && (
                          <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>
                            {post.description.substring(0, 50)}...
                          </Typography>
                        )}
                      </td>
                      <td>
                        <Chip size="sm" variant="soft">
                          {post.post_type}
                        </Chip>
                      </td>
                      <td>
                        <Chip
                          size="sm"
                          color={
                            post.status === 'published' ? 'success' :
                            post.status === 'draft' ? 'neutral' :
                            'warning'
                          }
                        >
                          {post.status}
                        </Chip>
                      </td>
                      <td>{post.slides?.length || 0}</td>
                      <td>
                        <Stack direction="row" spacing={1}>
                          <Chip size="sm" variant="plain" startDecorator="❤️">
                            {post.likes_count}
                          </Chip>
                          <Chip size="sm" variant="plain" startDecorator="💬">
                            {post.comments_count}
                          </Chip>
                          <Chip size="sm" variant="plain" startDecorator="📤">
                            {post.shares_count}
                          </Chip>
                        </Stack>
                      </td>
                      <td>
                        <Typography level="body-xs">
                          {new Date(post.created_at).toLocaleDateString()}
                        </Typography>
                      </td>
                      <td>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            size="sm"
                            variant="soft"
                            onClick={() => handleEditPost(post)}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="soft"
                            color="danger"
                            onClick={() => handleDeletePost(post.id)}
                          >
                            <Delete />
                          </IconButton>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Sheet>
          )}
        </CardContent>
      </Card>

      {/* Metadata Confirmation Modal */}
      <Modal open={showMetadataModal} onClose={() => setShowMetadataModal(false)}>
        <ModalDialog sx={{ maxWidth: 600 }}>
          <Typography level="h4">📊 Game Data Loaded</Typography>
          <Divider sx={{ my: 2 }} />
          
          {uploadedGameData && (
            <Stack spacing={2}>
              <Card variant="soft" color="primary">
                <CardContent>
                  <Typography level="title-lg" sx={{ mb: 1 }}>
                    {uploadedGameData.story?.matchup || 'Game Matchup'}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid xs={6}>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                        Game ID
                      </Typography>
                      <Typography level="title-sm">
                        {uploadedGameData.gameId}
                      </Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                        Date
                      </Typography>
                      <Typography level="title-sm">
                        {uploadedGameData.gameMetadata?.date}
                      </Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                        Arena
                      </Typography>
                      <Typography level="title-sm">
                        {uploadedGameData.gameMetadata?.arena}
                      </Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                        Fun Score
                      </Typography>
                      <Typography level="title-sm">
                        {uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]]?.fun_score || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid xs={12}>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                        Highlights Available
                      </Typography>
                      <Typography level="title-sm">
                        {uploadedGameData.script?.video_script?.length || 0} plays
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
              
              <Alert color="success" variant="soft">
                <Typography level="body-sm">
                  ✅ Game data loaded! You can now create multiple feed posts from this game.
                </Typography>
              </Alert>
              
              <Button
                size="lg"
                onClick={() => {
                  setShowMetadataModal(false)
                  setShowPostBuilder(true)
                }}
              >
                Start Creating Posts
              </Button>
            </Stack>
          )}
        </ModalDialog>
      </Modal>

      {/* Post Builder Modal with Stepper */}
      <Modal
        open={showPostBuilder}
        onClose={() => {
          if (confirm('Close without saving?')) {
            setShowPostBuilder(false)
            resetAll()
          }
        }}
      >
        <ModalDialog
          sx={{ 
            width: '90vw', 
            maxWidth: 1200, 
            maxHeight: '90vh', 
            overflow: 'auto',
            position: 'relative'
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ModalClose />
          
          {/* Drag Overlay */}
          {isDragging && !uploadedGameData && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 123, 255, 0.15)',
                backdropFilter: 'blur(4px)',
                border: '4px dashed',
                borderColor: 'primary.500',
                borderRadius: 'md',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                pointerEvents: 'none'
              }}
            >
              <Stack alignItems="center" spacing={2}>
                <Upload sx={{ fontSize: 80, color: 'primary.500' }} />
                <Typography level="h2" sx={{ color: 'primary.500', fontWeight: 900 }}>
                  Drop JSON file to load
                </Typography>
                <Typography level="body-lg" sx={{ color: 'primary.700' }}>
                  Game data will auto-populate
                </Typography>
              </Stack>
            </Box>
          )}
          
          <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography level="h4">
              {editingPost ? 'Edit Post' : 'Create Feed Post'}
          </Typography>
            {uploadedGameData && (
              <Chip color="primary" variant="soft">
                {existingPostsCount} post{existingPostsCount !== 1 ? 's' : ''} created for {uploadedGameData.gameId}
              </Chip>
            )}
          </Stack>
          <Divider sx={{ my: 2 }} />

          {/* Stepper */}
          <Stepper sx={{ width: '100%', mb: 3 }}>
            <Step
              indicator={
                <StepIndicator variant={activeStep === 0 ? 'solid' : 'soft'} color={activeStep === 0 ? 'primary' : 'neutral'}>
                  1
                </StepIndicator>
              }
            >
              <StepButton onClick={() => setActiveStep(0)}>Post Details</StepButton>
            </Step>
            <Step
              indicator={
                <StepIndicator variant={activeStep === 1 ? 'solid' : 'soft'} color={activeStep === 1 ? 'primary' : 'neutral'}>
                  2
                </StepIndicator>
              }
            >
              <StepButton onClick={() => setActiveStep(1)} disabled={!postForm.title}>
                Build Slides ({postForm.slides.length})
              </StepButton>
            </Step>
          </Stepper>

          {/* Step 1: Post Details */}
          {activeStep === 0 && (
          <Stack spacing={3}>
              {/* JSON Status - Compact */}
              {uploadedGameData && (
                <Alert color="success" variant="soft">
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Stack spacing={0.5} flex={1}>
                      <Typography level="title-sm">
                        ✅ {uploadedGameData.gameId}
                </Typography>
                      <Typography level="body-xs">
                        {uploadedGameData.script?.video_script?.length || 0} highlights available • Fun Score: {uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]]?.fun_score || 'N/A'}
                </Typography>
                      <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>
                        {uploadedGameData.story?.matchup || ''}
                      </Typography>
                    </Stack>
                  <Button
                      size="sm"
                      variant="soft"
                      color="warning"
                      startDecorator={<EmojiEvents />}
                      onClick={() => setShowFunScoreModal(true)}
                    >
                      View Fun Score
                  </Button>
                  </Stack>
                    </Alert>
                  )}

              {/* Post Details Form */}
            <Card variant="outlined">
              <CardContent>
                  <Typography level="title-lg" sx={{ mb: 3 }}>
                    Post Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={12} sm={6}>
                    <FormControl>
                      <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Post Type</FormLabel>
                      <Select
                        value={postForm.post_type}
                        onChange={(_, value) => setPostForm(prev => ({ ...prev, post_type: value as string }))}
                      >
                        <Option value="game_highlight">Game Highlight</Option>
                        <Option value="fun_score">Fun Score</Option>
                        <Option value="buzzer_beater">Buzzer Beater</Option>
                        <Option value="player_spotlight">Player Spotlight</Option>
                        <Option value="rookie_watch">Rookie Watch</Option>
                        <Option value="team_performance">Team Performance</Option>
                        <Option value="stat_showcase">Stat Showcase</Option>
                        <Option value="milestone">Milestone</Option>
                        <Option value="custom">Custom</Option>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid xs={12} sm={6}>
                    <FormControl>
                      <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Game ID (optional)</FormLabel>
                      <Input
                        value={postForm.game_id}
                        onChange={(e) => setPostForm(prev => ({ ...prev, game_id: e.target.value }))}
                        placeholder="e.g., 0022400123"
                      />
                    </FormControl>
                  </Grid>
                  <Grid xs={12}>
                    <FormControl>
                      <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Title (optional)</FormLabel>
                      <Input
                        value={postForm.title}
                        onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Rookie Sensation: 13 Points Off the Bench"
                      />
                    </FormControl>
                  </Grid>
                  <Grid xs={12}>
                    <FormControl>
                      <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Description</FormLabel>
                      <Textarea
                        value={postForm.description}
                        onChange={(e) => setPostForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the post..."
                        minRows={2}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

              {/* Step 1 Navigation */}
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button variant="plain" onClick={() => {
                  if (confirm('Cancel and close?')) {
                    setShowPostBuilder(false)
                    resetAll()
                  }
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="solid" 
                  onClick={() => setActiveStep(1)}
                  disabled={!postForm.title}
                >
                  Next: Build Slides →
                </Button>
              </Stack>
            </Stack>
          )}

          {/* Step 2: Build Slides */}
          {activeStep === 1 && (
            <Stack spacing={3}>
            <Card variant="outlined">
              <CardContent>
                  <Typography level="title-lg" sx={{ mb: 3 }}>
                    Build Slides ({postForm.slides.length})
                </Typography>
                
                {uploadedGameData && (
                  <Stack spacing={2}>
                    {/* Fun Score Button */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="sm"
                        variant="soft"
                        color="warning"
                        startDecorator={<EmojiEvents />}
                        onClick={() => setShowFunScoreModal(true)}
                      >
                        View Fun Score Data
                      </Button>
                    </Box>
                    
                    {/* Filter Controls */}
                    <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'md' }}>
                      <Typography level="title-sm" sx={{ mb: 2 }}>🔍 Filter Plays</Typography>
                      <Grid container spacing={2}>
                        <Grid xs={12}>
                          <FormControl size="sm">
                            <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Search Description</FormLabel>
                            <Input
                              placeholder="Search play descriptions..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              size="sm"
                              endDecorator={
                                searchQuery && (
                                  <IconButton
                                    size="sm"
                                    variant="plain"
                                    onClick={() => setSearchQuery('')}
                                  >
                                    <Cancel />
                                  </IconButton>
                                )
                              }
                            />
                          </FormControl>
                        </Grid>
                        <Grid xs={12} sm={4}>
                          <FormControl size="sm">
                            <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Player</FormLabel>
                            <Select
                              value={selectedPlayer}
                              onChange={(_, value) => setSelectedPlayer(value as string)}
                              size="sm"
                            >
                              <Option value="all">All Players</Option>
                              {getUniquePlayers().map(player => (
                                <Option key={player.personId} value={player.personId.toString()}>
                                  {player.fullName}
                                </Option>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid xs={12} sm={4}>
                          <FormControl size="sm">
                            <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Action Type</FormLabel>
                            <Select
                              value={selectedActionType}
                              onChange={(_, value) => setSelectedActionType(value as string)}
                              size="sm"
                            >
                              <Option value="all">All Actions</Option>
                              {getUniqueActionTypes().map(type => (
                                <Option key={type} value={type}>
                                  {type}
                                </Option>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid xs={12} sm={4}>
                          <FormControl size="sm">
                            <FormLabel sx={{ color: 'text.primary', fontWeight: 600 }}>Show</FormLabel>
                            <Select
                              value={showOnlyWithVideo ? 'video' : 'all'}
                              onChange={(_, value) => setShowOnlyWithVideo(value === 'video')}
                              size="sm"
                            >
                              <Option value="video">Only with Video</Option>
                              <Option value="all">All Plays</Option>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                        {getFilteredPlays().length} plays match filters
                      </Typography>
                      {selectedPlayer !== 'all' || selectedActionType !== 'all' || searchQuery ? (
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => {
                            setSelectedPlayer('all')
                            setSelectedActionType('all')
                            setShowOnlyWithVideo(true)
                            setSearchQuery('')
                          }}
                        >
                          Clear Filters
                        </Button>
                      ) : null}
                    </Box>
                    
                    <Box sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 'sm' }}>
                      <Stack spacing={0.5}>
                        {getFilteredPlays().map((play, index) => {
                          // Check if this play has assist info
                          const assistMatch = play.description.match(/\(([^)]+)\s+(\d+)\s+AST\)/)
                          const isAssist = assistMatch && playInvolvesPlayer(play, selectedPlayer) && play.personId.toString() !== selectedPlayer
                          
                          return (
                            <Box
                              key={index}
                              sx={{
                                p: 1.5,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 2,
                                bgcolor: isAssist ? 'success.50' : (!play.mp4 && play.video) ? 'warning.50' : 'transparent',
                                '&:hover': {
                                  bgcolor: isAssist ? 'success.100' : (!play.mp4 && play.video) ? 'warning.100' : 'background.level1'
                                },
                                '&:last-child': {
                                  borderBottom: 'none'
                                }
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                                  <Chip size="sm" variant="soft" color="neutral">
                                    Q{play.period}
                                  </Chip>
                                  <Chip size="sm" variant="soft" color="neutral">
                                    {play.clock.replace('PT', '').replace('S', '').replace('M', ':')}
                                  </Chip>
                                  <Chip size="sm" variant="soft" color="primary">
                                    {play.teamTricode}
                                  </Chip>
                                  {play.playerName && (
                                    <Chip size="sm" variant="soft">
                                      {play.playerName}
                                    </Chip>
                                  )}
                                  {isAssist && (
                                    <Chip size="sm" variant="solid" color="success">
                                      🎯 Assist
                                    </Chip>
                                  )}
                                  {!play.mp4 && play.video && (
                                    <Chip size="sm" variant="soft" color="warning">
                                      📹 Sequence
                                    </Chip>
                                  )}
                                  {play.actionType && (
                                    <Chip size="sm" variant="outlined">
                                      {play.actionType}
                                    </Chip>
                                  )}
                                </Stack>
                                <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                                  {play.description}
                                </Typography>
                                {(play.scoreHome || play.scoreAway) && (
                                  <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold', mt: 0.5 }}>
                                    Score: {play.scoreHome} - {play.scoreAway}
                                  </Typography>
                                )}
                                {!play.mp4 && play.video && (
                                  <Typography level="body-xs" sx={{ color: 'warning.600', mt: 0.5, fontStyle: 'italic' }}>
                                    ℹ️ Video from next play (sequence)
                                  </Typography>
                                )}
                              </Box>
                              <Button
                                size="sm"
                                variant="soft"
                                startDecorator={<Add />}
                                onClick={() => {
                                  handleAddSlide('video', play.originalIndex)
                                }}
                                sx={{ flexShrink: 0 }}
                                disabled={!play.video}
                              >
                                Add
                              </Button>
                            </Box>
                          )
                        })}
                      </Stack>
                    </Box>
                    <Divider />
                  </Stack>
                )}

                {/* Current Slides */}
                {postForm.slides.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Typography level="title-sm">Current Slides:</Typography>
                    {postForm.slides.map((slide, index) => (
                      <Box
                        key={index}
                        sx={{
                          p: 2,
                          border: '2px solid',
                          borderColor: 'primary.500',
                          borderRadius: 'md',
                          bgcolor: 'background.level1'
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography level="title-sm">#{index + 1}</Typography>
                          <Chip size="sm">{slide.type}</Chip>
                          <Typography level="body-sm" sx={{ flex: 1 }}>
                            {slide.caption || slide.description || 'No description'}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="sm"
                              disabled={index === 0}
                              onClick={() => handleMoveSlide(index, 'up')}
                            >
                              ↑
                            </IconButton>
                            <IconButton
                              size="sm"
                              disabled={index === postForm.slides.length - 1}
                              onClick={() => handleMoveSlide(index, 'down')}
                            >
                              ↓
                            </IconButton>
                            <IconButton
                              size="sm"
                              color="danger"
                              onClick={() => handleRemoveSlide(index)}
                            >
                              <Delete />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

              {/* Step 2 Navigation */}
              <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ mt: 3 }}>
              <Button
                  variant="plain"
                  onClick={() => setActiveStep(0)}
                >
                  ← Back to Details
              </Button>
                <Stack direction="row" spacing={1}>
              <Button
                variant="soft"
                startDecorator={<Save />}
                    onClick={() => handleSaveDraft(false)}
                    disabled={postForm.slides.length === 0 || !postForm.title}
              >
                    Save & Close
              </Button>
                  {uploadedGameData && (
                    <Button
                      variant="soft"
                      color="primary"
                      startDecorator={<Save />}
                      onClick={() => handleSaveDraft(true)}
                      disabled={postForm.slides.length === 0 || !postForm.title}
                    >
                      Save & Create New
                    </Button>
                  )}
              <Button
                variant="solid"
                color="success"
                startDecorator={<Visibility />}
                    onClick={() => handlePublish(false)}
                    disabled={postForm.slides.length === 0 || !postForm.title}
              >
                    Publish & Close
              </Button>
                  {uploadedGameData && (
                    <Button
                      variant="solid"
                      color="primary"
                      startDecorator={<Visibility />}
                      onClick={() => handlePublish(true)}
                      disabled={postForm.slides.length === 0 || !postForm.title}
                    >
                      Publish & Create New
                    </Button>
                  )}
            </Stack>
          </Stack>
            </Stack>
          )}
        </ModalDialog>
      </Modal>

      {/* Discard Confirmation Modal */}
      <Modal open={showDiscardConfirm} onClose={handleCancelDiscard}>
        <ModalDialog
          variant="outlined"
          role="alertdialog"
          sx={{
            maxWidth: 400,
            borderRadius: 'md',
            p: 3,
            boxShadow: 'lg',
          }}
        >
          <Typography level="h4" sx={{ mb: 1 }}>
            ⚠️ Replace JSON Data?
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography level="body-md" sx={{ mb: 3 }}>
            You already have JSON data loaded. Do you want to discard it and load the new file?
          </Typography>
          {uploadedGameData && (
            <Alert color="warning" variant="soft" sx={{ mb: 3 }}>
              <Typography level="body-sm">
                Currently loaded: <strong>{uploadedGameData.gameId}</strong>
              </Typography>
            </Alert>
          )}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="plain"
              color="neutral"
              onClick={handleCancelDiscard}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={handleDiscardAndLoad}
            >
              Discard & Load New
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Fun Score Data Modal */}
      <FunScoreDataModal
        open={showFunScoreModal}
        onClose={() => setShowFunScoreModal(false)}
        funScoreData={
          uploadedGameData && uploadedGameData.score 
            ? uploadedGameData.score[Object.keys(uploadedGameData.score)[0]]
            : null
        }
        gameId={uploadedGameData?.gameId}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        color={snackbar.color}
        variant="soft"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snackbar.message}
      </Snackbar>
    </Stack>
  )
}

