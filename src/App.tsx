import { useEffect } from 'react'
import { Routes, Route, useParams, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'
import PropPredictions from './pages/PropPredictions'
import DFS from './pages/DFS'
import DFSLineup from './pages/DFSLineup'
import DFSPoolDetails from './pages/DFSPoolDetails'
import JoinDFSPool from './pages/JoinDFSPool'
import JoinDFSGroup from './pages/JoinDFSGroup'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import League from './pages/League'
import Draft from './pages/Draft'
import DraftProspectsPage from './pages/DraftProspectsPage'
import Players from './pages/Players'
import MatchupDetails from './pages/MatchupDetails'
import DeleteLeague from './pages/DeleteLeague'
import TeamManagement from './pages/TeamManagement'
import TeamsAndDivisions from './pages/TeamsAndDivisions'
import DraftSettings from './pages/DraftSettings'
import DraftOrder from './pages/DraftOrder'
import Betting from './pages/Betting'
import JoinLeague from './pages/JoinLeague'
import EditRosterSettings from './pages/EditRosterSettings'
import CommissionerTools from './pages/CommissionerTools'
import PlayerPage from './pages/PlayerPage'
import TeamPage from './pages/TeamPage'
import ProspectPage from './pages/ProspectPage'
import AdminContentGame from './pages/AdminContentGame'
import AdminDFS from './pages/AdminDFS'
import AdminDFSPoolDetails from './pages/AdminDFSPoolDetails'
import AdminAnalytics from './pages/AdminAnalytics'
import Admin from './pages/Admin'
import TeamOfNightPage from './pages/TeamOfNightPage'

// Import Highlights and Post pages
import Highlights from './pages/Highlights'
import GamesHub from './pages/GamesHub'
import GamePage from './pages/GamePage'
import PostStory from './pages/PostStory'
import Post from './pages/Post'
import PostCreator from './pages/PostCreator'
import FeedLayout from './components/Feed/FeedLayout'
import ProfilePage from './pages/ProfilePage'
import MockDraftSharePage from './pages/MockDraftSharePage'
import SharedSlipPage from './pages/SharedSlipPage'
import Props from './pages/Props'

// Fantasy feature disabled – draft manager service not loaded
// import './services/draftManagerService'

const Analysis = () => (
  <div className="text-center py-8">
    <h1>📊 Basketball Analysis</h1>
    <p>Advanced analytics and insights coming soon</p>
  </div>
)

const Community = () => (
  <div className="text-center py-8">
    <h1>💬 Community</h1>
    <p>Discussions and debates coming soon</p>
  </div>
)

// Wrapper component for DeleteLeague to extract leagueId from URL params
const DeleteLeagueWrapper = () => {
  const { id } = useParams<{ id: string }>()
  return <DeleteLeague leagueId={id || ''} />
}

// Wrapper component for TeamsAndDivisions to extract leagueId from URL params
const TeamsAndDivisionsWrapper = () => {
  const { id } = useParams<{ id: string }>()
  return <TeamsAndDivisions />
}

// Wrapper component for TeamManagement to extract leagueId from URL params
const TeamManagementWrapper = () => {
  const { id } = useParams<{ id: string }>()
  return <TeamManagement leagueId={id || ''} />
}

// Wrapper component for DraftSettings to extract leagueId from URL params
const DraftSettingsWrapper = () => {
  const { id } = useParams<{ id: string }>()
  return <DraftSettings leagueId={id || ''} />
}

// Wrapper component for DraftOrder to extract leagueId from URL params
const DraftOrderWrapper = () => {
  const { id } = useParams<{ id: string }>()
  return <DraftOrder leagueId={id || ''} />
}

// Wrapper component for EditRosterSettings to extract leagueId from URL params
const EditRosterSettingsWrapper = () => {
  const { id } = useParams<{ id: string }>()
  return <EditRosterSettings />
}

// Wrapper component for CommissionerTools to extract leagueId from URL params
const CommissionerToolsWrapper = () => {
  const { id } = useParams<{ id: string }>()
  return <CommissionerTools leagueId={id || ''} />
}

// Wrapper component for PlayerPage (global player view, not league-specific)
const GlobalPlayerPageWrapper = () => {
  const { id } = useParams<{ id: string }>()
  console.log('🏀 Global Player Page - Player ID:', id)
  return (
    <PlayerPage 
      playerId={id || ''} 
      playerName="" 
      onBack={() => window.history.back()}
      // No leagueId or teamName - this is a global player view
    />
  )
}

/** Ensures only one video plays at a time app-wide: when any video plays, pause all others. */
function useSingleVideoPlay() {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const handlePlay = (e: Event) => {
      if ((e.target as HTMLElement)?.tagName !== 'VIDEO') return
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        timeoutId = null
        const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
        const playing = videos.filter((v) => !v.paused)
        if (playing.length <= 1) return
        // Keep the video that is most in view (React may have replaced the one that fired play).
        const viewportHeight = window.innerHeight
        let best: HTMLVideoElement | null = null
        let bestArea = 0
        const vw = window.innerWidth
        for (const v of playing) {
          const r = v.getBoundingClientRect()
          const visibleW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
          const visibleH = Math.max(0, Math.min(r.bottom, viewportHeight) - Math.max(r.top, 0))
          const area = visibleW * visibleH
          if (area > bestArea) {
            bestArea = area
            best = v
          }
        }
        playing.forEach((v) => {
          if (v !== best) v.pause()
        })
      }, 50)
    }
    document.addEventListener('play', handlePlay, true)
    return () => {
      document.removeEventListener('play', handlePlay, true)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])
}

function App() {
  useSingleVideoPlay()
  const gameFirstHomeEnabled = String(import.meta.env.VITE_ENABLE_GAME_FIRST_HOME ?? 'true').toLowerCase() !== 'false'

  return (
    <div className="app-root">
      <ScrollToTop />
      <Routes>
        {/* Public routes without layout */}
        <Route path="/join/:inviteCode" element={<JoinLeague />} />
        
        <Route path="/" element={<Layout />}>
          {/* Single persistent drawer shell for Home/Props/DFS/Draft + story view. */}
          <Route element={<FeedLayout />}>
            <Route index element={gameFirstHomeEnabled ? <GamesHub /> : <Highlights />} />
            <Route path="props" element={<Props />} />
            <Route path="dfs" element={<DFS />} />
            <Route path="draft" element={<DraftProspectsPage />} />
            <Route path="game/:id" element={<GamePage />} />

            {/* Backwards-compatible /feed/* aliases (kept for existing links). */}
            <Route path="feed" element={<Navigate to="/" replace />} />
            <Route path="feed/prop-predictions" element={<Navigate to="/props" replace />} />
            <Route path="feed/:slug" element={<PostStory />} />
          </Route>
          <Route path="login" element={<Login />} />
          
          {/* DFS Routes */}
          <Route path="dfs/join/:poolId" element={<JoinDFSPool />} />
          <Route path="dfs/group/:slug" element={<JoinDFSGroup />} />
          <Route path="dfs/lineup/:poolId" element={<DFSLineup />} />
          <Route path="dfs/pool/:poolId" element={<DFSPoolDetails />} />
          
          {/* Team of the Night (was under /today/totn; /today redirects to feed) */}
          <Route path="today/totn" element={<TeamOfNightPage />} />
          <Route path="today" element={<Navigate to="/" replace />} />
          <Route path="prop-predictions/:date" element={<PropPredictions />} />
          
          {/* Fantasy Routes */}
          <Route path="fantasy" element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="players" element={<Players leagueId="" />} />
          <Route path="player/:id" element={<GlobalPlayerPageWrapper />} />
          <Route path="prospect/:id" element={<ProspectPage />} />
          <Route path="team/:id" element={<TeamPage />} />
          <Route path="league/:id" element={<League />} />
          <Route path="league/:id/matchup/:matchupId" element={<MatchupDetails />} />
          <Route path="league/:id/delete" element={<DeleteLeagueWrapper />} />
          <Route path="league/:id/teams" element={<TeamManagementWrapper />} />
          <Route path="league/:id/teams-and-divisions" element={<TeamsAndDivisionsWrapper />} />
          <Route path="league/:id/draft-settings" element={<DraftSettingsWrapper />} />
          <Route path="league/:id/draft-order" element={<DraftOrderWrapper />} />
          <Route path="league/:id/roster-settings" element={<EditRosterSettingsWrapper />} />
          <Route path="league/:id/commissioner-tools" element={<CommissionerToolsWrapper />} />
          <Route path="draft/:id" element={<Draft />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="betting" element={<Betting />} />
          <Route path="community" element={<Community />} />
          
          <Route path="settings" element={<Navigate to="/profile" replace />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="messages" element={<Navigate to="/?drawer=messages" replace />} />
          <Route path="mock-draft/:shareToken" element={<MockDraftSharePage />} />
          <Route path="slip/:shareToken" element={<SharedSlipPage />} />
          
          {/* Admin Routes — single /admin with ?view= for create-post, dfs, analytics */}
          <Route path="admin" element={<Admin />} />
          <Route path="admin/feed" element={<Navigate to="/admin" replace />} />
          <Route path="admin/player" element={<Navigate to="/admin?view=player" replace />} />
          <Route path="admin/team" element={<Navigate to="/admin?view=team" replace />} />
          <Route path="admin/draft" element={<Navigate to="/admin?view=draft" replace />} />
          <Route path="admin/mock-draft" element={<Navigate to="/admin?view=mock-draft" replace />} />
          <Route path="admin/create-post" element={<Navigate to="/admin?view=create-post" replace />} />
          <Route path="admin/create-post/game/:gameId" element={<AdminContentGame />} />
          <Route path="admin/dfs" element={<Navigate to="/admin?view=dfs" replace />} />
          <Route path="admin/dfs/pool/:poolId" element={<AdminDFSPoolDetails />} />
          <Route path="admin/analytics" element={<Navigate to="/admin?view=analytics" replace />} />
          <Route path="admin/profile" element={<Navigate to="/admin?view=profile" replace />} />
          
          {/* OG Image generation route - handled by Cloudflare Worker, exclude from React Router */}
          <Route path="og-image/*" element={<></>} />
          
          {/* UUID route for shared posts - must come LAST to avoid conflicts with other routes */}
          <Route path=":uuid" element={<Post />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App