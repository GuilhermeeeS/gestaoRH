import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Padrão'

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <main className="flex flex-1 flex-col bg-background px-6 py-10 lg:px-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Sessão autenticada</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Painel do colaborador</h1>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2 shadow-sm">
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{user?.login}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{roleLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleLogout()
              }}
              disabled={isLoggingOut}
              className="flex items-center gap-2 rounded-2xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </Button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
