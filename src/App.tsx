import { Routes, Route, useParams } from 'react-router-dom'
import { Box } from '@mui/joy'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateLeague from './pages/CreateLeague'
import League from './pages/League'
import Draft from './pages/Draft'
import Players from './pages/Players'
import MatchupDetails from './pages/MatchupDetails'
import TeamPage from './pages/TeamPage'
import DeleteLeague from './pages/DeleteLeague'
import TeamManagement from './pages/TeamManagement'
import TeamsAndDivisions from './pages/TeamsAndDivisions'
import DraftSettings from './pages/DraftSettings'
import DraftOrder from './pages/DraftOrder'
import Betting from './pages/Betting'

// Placeholder components for new routes
const Highlights = () => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <h1>🏀 Daily Highlights</h1>
    <p>Coming soon: Game highlights with advanced stats analysis</p>
  </Box>
)

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

function App() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          
          {/* Fantasy Routes */}
          <Route path="fantasy" element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="create-league" element={<CreateLeague />} />
          <Route path="players" element={<Players leagueId="" />} />
          <Route path="league/:id" element={<League />} />
          <Route path="league/:id/matchup/:matchupId" element={<MatchupDetails />} />
          <Route path="league/:id/team/:teamId" element={<TeamPage />} />
          <Route path="league/:id/delete" element={<DeleteLeagueWrapper />} />
          <Route path="league/:id/teams" element={<TeamManagementWrapper />} />
          <Route path="league/:id/teams-and-divisions" element={<TeamsAndDivisionsWrapper />} />
          <Route path="league/:id/draft-settings" element={<DraftSettingsWrapper />} />
          <Route path="league/:id/draft-order" element={<DraftOrderWrapper />} />
          <Route path="draft/:id" element={<Draft />} />
          
          {/* New Feature Routes */}
          <Route path="highlights" element={<Highlights />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="betting" element={<Betting />} />
          <Route path="community" element={<Community />} />
        </Route>
      </Routes>
    </Box>
  )
}

export default App