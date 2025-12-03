import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/index.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
