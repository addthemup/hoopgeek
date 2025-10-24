import { Outlet } from 'react-router-dom'
import { Box } from '@mui/joy'
import TopNavigation from './TopNavigation'

export default function Layout() {
  return (
    <Box sx={{ 
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <TopNavigation />
      <Box component="main" sx={{ 
        flex: 1,
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        marginTop: '65px' // Account for fixed navigation height
      }}>
        <Outlet />
      </Box>
    </Box>
  )
}
