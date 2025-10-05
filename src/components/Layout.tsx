import { Outlet } from 'react-router-dom'
import { Box } from '@mui/joy'
import TopNavigation from './TopNavigation'

export default function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', width: '100%' }}>
      <TopNavigation />
      <Box component="main" sx={{ width: '100%' }}>
        <Outlet />
      </Box>
    </Box>
  )
}
