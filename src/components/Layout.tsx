import { Outlet } from 'react-router-dom'
import { Box } from '@mui/joy'
import TopNavigation from './TopNavigation'

export default function Layout() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <TopNavigation />
      <Box component="main" sx={{ p: { xs: 0, sm: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  )
}
