import { Outlet } from 'react-router-dom'
import { Box, AppBar, Toolbar, Typography, Button, Stack } from '@mui/joy'
import { useAuth } from '../hooks/useAuth'

export default function Layout() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography level="h3" component="div" sx={{ flexGrow: 1 }}>
            🏀 HoopGeek
          </Typography>
          <Stack direction="row" spacing={2}>
            {user ? (
              <>
                <Typography level="body-sm">
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
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
