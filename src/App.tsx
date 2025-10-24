import { Routes, Route, useParams } from 'react-router-dom'
import { Box } from '@mui/joy'
import Layout from './components/Layout'
import Home from './pages/Home'
import DFS from './pages/DFS'
import DFSLineup from './pages/DFSLineup'
import DFSPoolLeaderboard from './pages/DFSPoolLeaderboard'
import JoinDFSPool from './pages/JoinDFSPool'
import GamePage from './pages/GamePage'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import League from './pages/League'
import Draft from './pages/Draft'
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
import UserSettings from './pages/UserSettings'
import PlayerPage from './pages/PlayerPage'

// Import Highlights page
import Highlights from './pages/Highlights'

// Import global draft manager service (auto-starts on import)
import './services/draftManagerService'

const Analysis = () => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <h1>📊 Basketball Analysis</h1>
    <p>Advanced analytics and insights coming soon</p>
  </Box>
)

const Community = () => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <h1>💬 Community</h1>
    <p>Discussions and debates coming soon</p>
  </Box>
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

function App() {
  return (
    <Box sx={{ 
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      position: 'relative',
      backgroundColor: 'var(--newsprint-bg)',
      // Newspaper texture overlay
      backgroundImage: `
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0,0,0,.015) 2px,
          rgba(0,0,0,.015) 4px
        )
      `,
      fontFamily: 'var(--joy-fontFamily-body)',
      '&::before': {
        content: '""',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'linear-gradient(90deg, #000 0%, #000 33%, #8B0000 33%, #8B0000 34%, #000 34%, #000 100%)',
        zIndex: 10000,
      }
    }}>
      <Routes>
        {/* Public routes without layout */}
        <Route path="/join/:inviteCode" element={<JoinLeague />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          
          {/* DFS Routes */}
          <Route path="dfs" element={<DFS />} />
          <Route path="dfs/join/:poolId" element={<JoinDFSPool />} />
          <Route path="dfs/lineup/:poolId" element={<DFSLineup />} />
          <Route path="dfs/pool/:poolId" element={<DFSPoolLeaderboard />} />
          
          {/* Game Highlights Routes */}
          <Route path="game/:id" element={<GamePage />} />
          
          {/* Fantasy Routes */}
          <Route path="fantasy" element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="players" element={<Players leagueId="" />} />
          <Route path="player/:id" element={<GlobalPlayerPageWrapper />} />
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
          
          {/* New Feature Routes */}
          <Route path="highlights" element={<Highlights />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="betting" element={<Betting />} />
          <Route path="community" element={<Community />} />
          
          {/* User Settings */}
          <Route path="settings" element={<UserSettings />} />
        </Route>
      </Routes>
    </Box>
  )
}

export default App