import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCcw, Shield, Trash2, UserPlus, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API_BASE_URL, parseJsonResponse } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { AuthUser, UserRole } from '@/types/auth'
import { ErrorIndicator, LoadingIndicator } from '@/components/ui/status-indicator'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

type UsersResponse = {
  users: AuthUser[]
}

export default function AdminUsersPage() {
  const { user, initializing } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [newUser, setNewUser] = useState<{ login: string; password: string; role: UserRole }>({ login: '', password: '', role: 'padrao' })
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [createStatus, setCreateStatus] = useState<LoadStatus>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchUsers = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await parseJsonResponse<{ message?: string }>(response)
        throw new Error(payload.message ?? 'Não foi possível carregar os usuários')
      }
      const payload = await parseJsonResponse<UsersResponse>(response)
      setUsers(Array.isArray(payload.users) ? payload.users : [])
      setStatus('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar usuários'
      setError(message)
      setStatus('error')
    }
  }, [])

  const canManage = user?.role === 'admin'

  useEffect(() => {
    if (canManage) {
      void fetchUsers()
    } else {
      setUsers([])
    }
  }, [fetchUsers, canManage])

  const activeCount = useMemo(() => users.filter((user) => user.active).length, [users])

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const login = newUser.login.trim()
    if (!login) {
      setCreateError('Informe o login do usuário.')
      return
    }
    if (newUser.password.length < 6) {
      setCreateError('A senha deve conter ao menos 6 caracteres.')
      return
    }
    setCreateStatus('loading')
    setCreateError(null)
    setCreateSuccess(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, password: newUser.password, role: newUser.role }),
      })
      if (!response.ok) {
        const payload = await parseJsonResponse<{ message?: string }>(response)
        throw new Error(payload.message ?? 'Não foi possível criar o usuário')
      }
      await parseJsonResponse<{ user: AuthUser }>(response)
      setNewUser({ login: '', password: '', role: 'padrao' })
      setCreateSuccess('Usuário criado com sucesso.')
      await fetchUsers()
      setCreateStatus('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao criar usuário'
      setCreateError(message)
      setCreateStatus('error')
    } finally {
      setTimeout(() => {
        setCreateStatus('idle')
      }, 300)
    }
  }

  const handleDeleteUser = async (targetUser: AuthUser) => {
    if (targetUser.id === user?.id) {
      setDeleteError('Você não pode remover sua própria conta enquanto estiver conectado.')
      return
    }

    const confirmed = window.confirm(`Remover o usuário "${targetUser.login}"? Essa ação não pode ser desfeita.`)
    if (!confirmed) {
      return
    }

    setDeleteError(null)
    setDeletingId(targetUser.id)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await parseJsonResponse<{ message?: string }>(response)
        throw new Error(payload.message ?? 'Não foi possível remover o usuário')
      }
      await fetchUsers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao remover usuário'
      setDeleteError(message)
    } finally {
      setDeletingId(null)
    }
  }

  if (initializing) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <LoadingIndicator size="lg" label="Verificando permissões" />
        Verificando permissões...
      </div>
    )
  }

  if (!user || !canManage) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <XCircle className="h-14 w-14 text-red-500" aria-hidden="true" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">Esta área é reservada exclusivamente para administradores.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Administração · Admin</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Gestão de usuários do sistema</h1>
          <p className="text-sm text-muted-foreground">Controle quem pode acessar o painel unificado e suas permissões.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void fetchUsers()
          }}
          disabled={status === 'loading'}
          className="flex items-center gap-2 rounded-2xl border-border bg-card text-sm font-semibold text-foreground"
        >
          <RefreshCcw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar
        </Button>
      </header>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Cadastro</p>
            <h2 className="text-xl font-semibold text-foreground">Criar novo usuário</h2>
            <p className="text-sm text-muted-foreground">Defina login, senha temporária e perfil de acesso.</p>
          </div>
        </div>

        <form onSubmit={handleCreateUser} className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-[11px] uppercase text-muted-foreground">Login</label>
            <input
              type="text"
              value={newUser.login}
              onChange={(event) => setNewUser((prev) => ({ ...prev, login: event.target.value }))}
              placeholder="nome.sobrenome"
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase text-muted-foreground">Senha inicial</label>
            <input
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Senha provisória"
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] uppercase text-muted-foreground">Perfil</label>
            <select
              value={newUser.role}
              onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value as UserRole }))}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="padrao">Padrão</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <Button
              type="submit"
              disabled={createStatus === 'loading'}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              {createStatus === 'loading' ? (
                <>
                  <LoadingIndicator size="sm" label="Cadastrando usuário" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Cadastrar usuário
                </>
              )}
            </Button>
          </div>
        </form>
        {createError ? <ErrorIndicator message={createError} size="sm" className="mt-3 text-sm" /> : null}
        {createSuccess ? <p className="mt-3 text-sm text-emerald-600">{createSuccess}</p> : null}
      </section>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Resumo</p>
            <h2 className="text-xl font-semibold text-foreground">{activeCount} usuários ativos</h2>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-2 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs uppercase text-muted-foreground">Funções liberadas</p>
              <p className="font-semibold text-foreground">Admin · Padrão</p>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          {status === 'loading' ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
              <LoadingIndicator size="sm" label="Sincronizando lista de usuários" />
              Lista de usuários em sincronização...
            </div>
          ) : null}
          {status === 'error' && error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
              <ErrorIndicator message={error} size="sm" />
            </div>
          ) : null}
          {status === 'success' && users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : null}

          {users.length > 0 ? (
            <table className="mt-4 w-full min-w-[720px] text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Login</th>
                  <th className="px-3 py-2 text-left font-semibold">Perfil</th>
                  <th className="px-3 py-2 text-left font-semibold">Criado em</th>
                  <th className="px-3 py-2 text-left font-semibold">Último acesso</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((listedUser) => (
                  <tr key={listedUser.id} className="border-t border-border/70 text-sm">
                    <td className="px-3 py-3 font-semibold text-foreground">{listedUser.login}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase text-primary">
                        {listedUser.role === 'admin' ? 'Admin' : 'Padrão'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDate(listedUser.createdAt)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{listedUser.lastLoginAt ? formatDate(listedUser.lastLoginAt) : 'Nunca'}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${listedUser.active ? 'bg-emerald-100 text-emerald-700' : 'bg-border text-muted-foreground'}`}>
                        {listedUser.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        disabled={deletingId === listedUser.id}
                        onClick={() => {
                          void handleDeleteUser(listedUser)
                        }}
                      >
                        {deletingId === listedUser.id ? (
                          <LoadingIndicator size="sm" label="Removendo usuário" iconClassName="h-3.5 w-3.5" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {deleteError ? <ErrorIndicator message={deleteError} size="sm" className="mt-4 text-sm" /> : null}
        </div>
      </section>
    </div>
  )
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('pt-BR')
  } catch {
    return value
  }
}
