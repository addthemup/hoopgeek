import { Outlet } from 'react-router-dom'
import { Box } from '@mui/joy'
import TopNavigation from './TopNavigation'

export default function Layout() {
  return (
    <Box sx={{ 
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden'
    }}>
      <TopNavigation />
      <Box component="main" sx={{ 
        p: { xs: 0, sm: 3 },
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden'
      }}>
        <Outlet />
      </Box>
    </Box>
  )
}
