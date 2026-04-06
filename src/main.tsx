import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CssVarsProvider } from '@mui/joy/styles'
import CssBaseline from '@mui/joy/CssBaseline'
import App from './App.tsx'
import './index.css'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CssVarsProvider
        defaultMode="system"
        modeStorageKey="hoopgeek-mode"
        disableTransitionOnChange={false}
      >
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CssVarsProvider>
    </QueryClientProvider>
  </StrictMode>,
)