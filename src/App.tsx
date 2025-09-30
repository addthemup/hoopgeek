import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/joy'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateLeague from './pages/CreateLeague'
import League from './pages/League'
import Draft from './pages/Draft'
import Players from './pages/Players'

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

const Betting = () => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <h1>💰 Betting Insights</h1>
    <p>Betting analysis and odds coming soon</p>
  </Box>
)

const Community = () => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <h1>💬 Community</h1>
    <p>Discussions and debates coming soon</p>
  </Box>
)

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
          <Route path="players" element={<Players />} />
          <Route path="league/:id" element={<League />} />
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