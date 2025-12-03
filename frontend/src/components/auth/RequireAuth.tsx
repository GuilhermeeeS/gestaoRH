import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingIndicator } from '@/components/ui/status-indicator'

type RequireAuthProps = {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <LoadingIndicator size="lg" className="text-muted-foreground" label="Validando sessão" />
        <p className="text-sm text-muted-foreground">Validando sessão...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
