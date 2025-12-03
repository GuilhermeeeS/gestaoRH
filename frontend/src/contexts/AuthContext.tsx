import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { API_BASE_URL, parseJsonResponse } from '@/lib/api'
import type { AuthUser } from '@/types/auth'

type AuthContextValue = {
  user: AuthUser | null
  initializing: boolean
  login: (login: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [initializing, setInitializing] = useState(true)

  const refreshProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include',
      })
      if (!response.ok) {
        setUser(null)
        return
      }
      const payload = await parseJsonResponse<{ user?: AuthUser }>(response)
      if (payload.user) {
        setUser(payload.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Falha ao carregar sessão', error)
      setUser(null)
    } finally {
      setInitializing(false)
    }
  }, [])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  const login = useCallback(async (loginField: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ login: loginField, password }),
    })

    if (!response.ok) {
      let message = 'Não foi possível autenticar'
      try {
        const payload = await parseJsonResponse<{ message?: string }>(response)
        message = payload.message ?? message
      } catch (error) {
        console.error('Falha ao interpretar erro de login', error)
      }
      throw new Error(message)
    }

    const payload = await parseJsonResponse<{ user: AuthUser }>(response)
    setUser(payload.user)
    return payload.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, initializing, login, logout, refreshProfile }), [user, initializing, login, logout, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
