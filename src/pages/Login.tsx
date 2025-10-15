import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Box, 
  Typography, 
  Button, 
  Input, 
  FormControl, 
  FormLabel, 
  Alert,
  Stack,
  Card,
  CardContent,
  Divider
} from '@mui/joy'
import { Google } from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../utils/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
        } else {
          setMessage('Check your email for a confirmation link!')
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          navigate('/dashboard')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      }
      // If successful, user will be redirected by Supabase
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '60vh',
      px: 2
    }}>
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent>
          <Typography level="h2" sx={{ textAlign: 'center', mb: 3 }}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Typography>
          
          {error && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {message && (
            <Alert color="success" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}

          {/* Google Sign In Button */}
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Button
              size="lg"
              variant="outlined"
              color="neutral"
              startDecorator={<Google />}
              onClick={handleGoogleSignIn}
              loading={loading}
              fullWidth
            >
              Continue with Google
            </Button>
            
            <Divider>
              <Typography level="body-xs" color="neutral">
                or continue with email
              </Typography>
            </Divider>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <FormControl required>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </FormControl>
              
              <FormControl required>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </FormControl>
              
              <Button 
                type="submit" 
                loading={loading}
                size="lg"
                sx={{ mt: 2 }}
              >
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
              
              <Button
                variant="plain"
                onClick={() => setIsSignUp(!isSignUp)}
                sx={{ mt: 1 }}
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"
                }
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
