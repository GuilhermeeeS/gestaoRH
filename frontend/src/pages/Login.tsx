import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { ErrorIndicator, LoadingIndicator } from '@/components/ui/status-indicator'

export default function LoginPage() {
  const { user, initializing, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loginField, setLoginField] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: Location } | undefined
    return state?.from?.pathname ?? '/dashboard'
  }, [location.state])

  useEffect(() => {
    if (!initializing && user) {
      navigate(redirectPath, { replace: true })
    }
  }, [initializing, user, redirectPath, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!loginField.trim() || !password.trim()) {
      setError('Informe login e senha para continuar.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await login(loginField.trim(), password)
      navigate(redirectPath, { replace: true })
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : 'Não foi possível autenticar'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md space-y-6 rounded-[28px] border border-border bg-card p-10 shadow-xl">
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 text-[11px] uppercase text-muted-foreground">
            <span className="h-[2px] w-8 rounded-full bg-primary/70" />
            Control ID
            <span className="h-[2px] w-8 rounded-full bg-primary/70" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Painel Unificado</h1>
          <p className="text-sm text-muted-foreground">Acesse com suas credenciais Padrão ou Admin.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase text-muted-foreground">Usuário</label>
            <input
              type="text"
              name="login"
              value={loginField}
              onChange={(event) => setLoginField(event.target.value)}
              placeholder="admin.control"
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase text-muted-foreground">Senha</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 w-full rounded-2xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-secondary"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingIndicator size="sm" label="Validando credenciais" />
                Validando credenciais...
              </span>
            ) : (
              'Entrar no Dashboard'
            )}
          </Button>
        </form>
        {error ? <ErrorIndicator message={error} size="sm" className="justify-center text-sm" /> : null}
        <p className="text-center text-xs text-muted-foreground">Sessões ficam ativas por 1 hora ou até você sair manualmente.</p>
      </div>
    </div>
  )
}
