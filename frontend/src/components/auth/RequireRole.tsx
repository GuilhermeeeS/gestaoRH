import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types/auth'
import { LoadingIndicator } from '@/components/ui/status-indicator'

type RequireRoleProps = {
  role: UserRole | UserRole[]
  children: ReactNode
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, initializing } = useAuth()
  const location = useLocation()
  const roles = Array.isArray(role) ? role : [role]

  if (initializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <LoadingIndicator size="lg" className="text-muted-foreground" label="Validando permissões" />
        <p className="text-sm text-muted-foreground">Validando permissões...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
