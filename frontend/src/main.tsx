import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConversationProvider } from '@elevenlabs/react'
import App from './App'
import { AuthProvider } from './lib/auth'
import './index.css'

// ClerkProvider is applied inside AuthProvider, and only when
// VITE_CLERK_PUBLISHABLE_KEY is set — otherwise the app runs in guest mode.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ConversationProvider>
          <App />
        </ConversationProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
