import { Outlet } from 'react-router-dom'
import { Box, Sheet, Typography, Button, Stack } from '@mui/joy'
import { useAuth } from '../hooks/useAuth'

export default function Layout() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Sheet 
        variant="solid" 
        color="primary" 
        sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Typography level="h3">
          🏀 HoopGeek
        </Typography>
        <Stack direction="row" spacing={2}>
          {user ? (
            <>
              <Typography level="body-sm" sx={{ color: 'inherit' }}>
                Welcome, {user.email}
              </Typography>
              <Button variant="soft" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button variant="solid" href="/login">
              Sign In
            </Button>
          )}
        </Stack>
      </Sheet>
      <Box component="main" sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
