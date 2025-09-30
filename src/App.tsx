import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/joy'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateLeague from './pages/CreateLeague'
import League from './pages/League'
import Draft from './pages/Draft'
import NBAPlayers from './components/NBAPlayers'

function App() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="create-league" element={<CreateLeague />} />
          <Route path="players" element={<NBAPlayers />} />
          <Route path="league/:id" element={<League />} />
          <Route path="draft/:id" element={<Draft />} />
        </Route>
      </Routes>
    </Box>
  )
}

export default App