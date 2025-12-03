import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorIndicator, LoadingIndicator } from '@/components/ui/status-indicator'
import { API_BASE_URL } from '@/lib/api'

type ClockUser = {
  uid: string
  name: string
  cpf: string | null
  registration: string | null
  rfid: string | null
  hasFace: boolean
}

type ListStatus = 'idle' | 'loading' | 'success' | 'error'
const PAGE_SIZE = 100

type NewUserForm = {
  admin: boolean
  code: string
  name: string
  cpf: string
  registration: string
  rfid: string
  password: string
  imageBase64: string
}

type ExistingUserForm = {
  cpf: string
  name: string
  bars: string
  code: string
  password: string
  rfid: string
  admin: boolean
}

type PhotoUpdateForm = {
  cpf: string
  imageBase64: string
}

type BRGOActionName = 'update-general' | 'update-photo' | 'remove-photo' | 'remove-user' | 'add-user'

type BRGOActionResult = {
  clockId: string
  clockLabel: string
  ip: string
  ok: boolean
  attempts: number
  statusCode: number | null
  message: string | null
}

type BRGOActionSummary = {
  action: BRGOActionName
  generatedAt: string
  total: number
  success: number
  failure: number
  results: BRGOActionResult[]
}

type ActionState = {
  status: 'idle' | 'running' | 'success' | 'error'
  type: BRGOActionName | null
  error: string | null
  report: BRGOActionSummary | null
}

const ACTION_LABELS: Record<BRGOActionName, string> = {
  'update-general': 'Atualização de dados',
  'update-photo': 'Atualização de foto',
  'remove-photo': 'Remoção de foto',
  'remove-user': 'Remoção de colaborador',
  'add-user': 'Cadastro de colaborador',
}

const initialActionState: ActionState = {
  status: 'idle',
  type: null,
  error: null,
  report: null,
}

const initialNewUser: NewUserForm = {
  admin: false,
  code: '',
  name: '',
  cpf: '',
  registration: '',
  rfid: '',
  password: '',
  imageBase64: '',
}

const initialEditForm: ExistingUserForm = {
  cpf: '',
  name: '',
  bars: '',
  code: '',
  password: '',
  rfid: '',
  admin: false,
}

const initialPhotoForm: PhotoUpdateForm = {
  cpf: '',
  imageBase64: '',
}

export default function BRGOEmployeesPage() {
  const [newUser, setNewUser] = useState<NewUserForm>(initialNewUser)
  const [newUserPreview, setNewUserPreview] = useState<string | null>(null)
  const [newUserError, setNewUserError] = useState<string | null>(null)
  const [deleteCpf, setDeleteCpf] = useState('')
  const [users, setUsers] = useState<ClockUser[]>([])
  const [listStatus, setListStatus] = useState<ListStatus>('idle')
  const [listError, setListError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isAppending, setIsAppending] = useState(false)
  const [totalUsers, setTotalUsers] = useState<number | null>(null)
  const [totalStatus, setTotalStatus] = useState<ListStatus>('idle')
  const [totalError, setTotalError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ClockUser | null>(null)
  const [editForm, setEditForm] = useState<ExistingUserForm>(initialEditForm)
  const [photoForm, setPhotoForm] = useState<PhotoUpdateForm>(initialPhotoForm)
  const [photoImagePreview, setPhotoImagePreview] = useState<string | null>(null)
  const [removePhotoCpf, setRemovePhotoCpf] = useState('')
  const [actionState, setActionState] = useState<ActionState>({ ...initialActionState })
  const offsetRef = useRef(0)
  const loadedCount = users.length

  const loadUsers = useCallback(async (options?: { append?: boolean }) => {
    const append = Boolean(options?.append)
    if (append) {
      setIsAppending(true)
    } else {
      setListStatus('loading')
      offsetRef.current = 0
      setHasMore(true)
    }
    setListError(null)
    const nextOffset = append ? offsetRef.current + PAGE_SIZE : 0
    try {
      const response = await fetch(`${API_BASE_URL}/api/brgo/users?limit=${PAGE_SIZE}&offset=${nextOffset}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Falha na API (${response.status})`)
      }
      const payload = await response.json()
      const fetchedUsers = Array.isArray(payload.users) ? payload.users.map(mapApiUserToClockUser) : []
      setUsers((prev) => sortUsersAlphabetically(append ? [...prev, ...fetchedUsers] : fetchedUsers))
      offsetRef.current = nextOffset
      setHasMore(fetchedUsers.length === PAGE_SIZE)
      setListStatus('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      setListError(message)
      setListStatus('error')
      setHasMore(false)
    } finally {
      setIsAppending(false)
    }
  }, [])

  const loadTotalUsers = useCallback(async () => {
    setTotalStatus('loading')
    setTotalError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/overview/users/brgo`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Falha na contagem (${response.status})`)
      }
      const payload = (await response.json()) as { count?: number }
      const rawCount = Number(payload?.count ?? 0)
      const safeCount = Number.isFinite(rawCount) ? rawCount : 0
      setTotalUsers(safeCount)
      setTotalStatus('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro na contagem'
      setTotalError(message)
      setTotalUsers(null)
      setTotalStatus('error')
    }
  }, [])

  useEffect(() => {
    loadTotalUsers()
    loadUsers()
  }, [loadTotalUsers, loadUsers])

  useEffect(() => {
    if (totalUsers != null && loadedCount >= totalUsers) {
      setHasMore(false)
    }
  }, [totalUsers, loadedCount])

  const remainingUsers = totalUsers != null ? Math.max(totalUsers - loadedCount, 0) : null
  const countSummaryText = (() => {
    if (totalUsers != null) {
      const suffix = remainingUsers && remainingUsers > 0 ? ` · Faltam ${remainingUsers}` : ' · Todos carregados'
      return `Mostrando ${loadedCount} de ${totalUsers}${suffix}`
    }
    return 'Contagem indisponível'
  })()

  const handleRefreshList = useCallback(() => {
    setUsers([])
    loadTotalUsers()
    loadUsers()
  }, [loadTotalUsers, loadUsers])

  const resetActionState = useCallback(() => {
    setActionState({ ...initialActionState })
  }, [])

  const showActionError = useCallback((type: BRGOActionName, message: string) => {
    setActionState({ status: 'error', type, error: message, report: null })
  }, [])

  const executeBRGOAction = useCallback(
    async (type: BRGOActionName, endpoint: string, payload: Record<string, unknown>) => {
      setActionState({ status: 'running', type, error: null, report: null })
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          const friendly = extractFriendlyActionError(errorText)
          const fallback = `Não foi possível concluir a ação (HTTP ${response.status}).`
          throw new Error(friendly ?? fallback)
        }

        const summary = (await response.json()) as BRGOActionSummary
        setActionState({ status: 'success', type, error: null, report: summary })
        handleRefreshList()
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha desconhecida'
        setActionState({ status: 'error', type, error: message, report: null })
        return false
      }
    },
    [handleRefreshList],
  )

  const handleDismissReport = useCallback(() => {
    resetActionState()
  }, [resetActionState])

  const isLoadingUsers = listStatus === 'loading'
  const loadMoreDisabled = !hasMore
  const loadMoreBusy = isAppending

  const loadMoreLabel = loadMoreDisabled ? 'Tudo carregado' : 'Carregar mais'
  const addActionRunning = actionState.type === 'add-user' && actionState.status === 'running'
  const deleteActionRunning = actionState.type === 'remove-user' && actionState.status === 'running'
  const modalEligibleAction = actionState.type === 'add-user' || actionState.type === 'remove-user'
  const showActionModal = Boolean(modalEligibleAction && actionState.status !== 'idle')
  const modalIsRunning = showActionModal && actionState.status === 'running'
  const modalError = showActionModal && actionState.status === 'error' ? actionState.error : null
  const modalReport = showActionModal ? actionState.report : null

  const isActionRunning = actionState.status === 'running'
  const actionHeadline = actionState.type ? ACTION_LABELS[actionState.type] : 'Sincronizando alterações'
  const reportTimestamp = actionState.report ? new Date(actionState.report.generatedAt).toLocaleString('pt-BR') : null
  const displayedUsers = users

  const handleLoadMore = () => {
    if (loadMoreDisabled || loadMoreBusy) {
      return
    }
    loadUsers({ append: true })
  }

  const handleFormChange = (field: keyof NewUserForm) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setNewUserError(null)
    setNewUser((prev) => ({ ...prev, [field]: value }))
  }

  const handleAdminToggle = () => {
    setNewUserError(null)
    setNewUser((prev) => ({ ...prev, admin: !prev.admin }))
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [, base64 = ''] = result.split(',')
      setNewUser((prev) => ({ ...prev, imageBase64: base64 }))
      setNewUserPreview(result)
      setNewUserError(null)
    }
    reader.readAsDataURL(file)
  }

  const parseNumericInput = (value: string): number | undefined => {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const handleSubmitNewUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNewUserError(null)

    const name = newUser.name.trim()
    if (!name) {
      setNewUserError('Informe o nome completo do colaborador.')
      return
    }

    const cpfNumber = parseNumericInput(newUser.cpf)
    if (cpfNumber === undefined) {
      setNewUserError('Informe um CPF válido (somente números).')
      return
    }

    const payload = {
      admin: newUser.admin,
      code: parseNumericInput(newUser.code),
      name,
      cpf: cpfNumber,
      registration: parseNumericInput(newUser.registration),
      rfid: parseNumericInput(newUser.rfid),
      password: newUser.password.trim() || undefined,
      imageBase64: newUser.imageBase64 || undefined,
    }

    const success = await executeBRGOAction('add-user', '/api/brgo/users/add', payload)
    if (success) {
      setNewUser({ ...initialNewUser })
      setNewUserPreview(null)
      setNewUserError(null)
    }
  }

  const handleDeleteUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cpf = deleteCpf.trim()
    if (!cpf) {
      window.alert('Informe o CPF do colaborador antes de remover.')
      return
    }

    const success = await executeBRGOAction('remove-user', '/api/brgo/users/remove', { cpf })
    if (success) {
      setDeleteCpf('')
    }
  }

  const handleDeleteFromList = async (user: ClockUser) => {
    if (!user.cpf) {
      window.alert('Não foi possível remover: o colaborador está sem CPF cadastrado.')
      return
    }

    await executeBRGOAction('remove-user', '/api/brgo/users/remove', { cpf: user.cpf })
  }

  const openEditModal = (user: ClockUser) => {
    resetActionState()
    setEditingUser(user)
    setEditForm({
      cpf: user.cpf ?? '',
      name: user.name ?? '',
      bars: user.registration ?? '',
      code: user.uid ?? '',
      password: '',
      rfid: user.rfid ?? '',
      admin: false,
    })
    setPhotoForm({ cpf: user.cpf ?? '', imageBase64: '' })
    setRemovePhotoCpf(user.cpf ?? '')
    setPhotoImagePreview(null)
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    resetActionState()
    setIsEditModalOpen(false)
    setEditingUser(null)
    setEditForm(initialEditForm)
    setPhotoForm(initialPhotoForm)
    setPhotoImagePreview(null)
    setRemovePhotoCpf('')
  }

  const handleEditFormChange = (field: keyof ExistingUserForm) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditToggleAdmin = () => {
    setEditForm((prev) => ({ ...prev, admin: !prev.admin }))
  }

  const handleSubmitEditUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editForm.cpf.trim()) {
      showActionError('update-general', 'Informe o CPF do colaborador para sincronizar a atualização.')
      return
    }

    await executeBRGOAction('update-general', '/api/brgo/users/update', {
      cpf: editForm.cpf,
      name: editForm.name,
      bars: editForm.bars,
      code: editForm.code,
      password: editForm.password,
      rfid: editForm.rfid,
      admin: editForm.admin,
    })
  }

  const handlePhotoCpfChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setPhotoForm((prev) => ({ ...prev, cpf: value }))
  }

  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [, base64 = ''] = result.split(',')
      setPhotoForm((prev) => ({ ...prev, imageBase64: base64 }))
      setPhotoImagePreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitPhotoUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!photoForm.cpf.trim()) {
      showActionError('update-photo', 'Informe o CPF para enviar a nova foto.')
      return
    }
    if (!photoForm.imageBase64) {
      showActionError('update-photo', 'Selecione uma imagem JPG/PNG para enviar aos relógios.')
      return
    }

    await executeBRGOAction('update-photo', '/api/brgo/users/update-photo', {
      cpf: photoForm.cpf,
      imageBase64: photoForm.imageBase64,
    })
  }

  const handleRemovePhoto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!removePhotoCpf.trim()) {
      showActionError('remove-photo', 'Informe o CPF para remover a foto.')
      return
    }

    await executeBRGOAction('remove-photo', '/api/brgo/users/remove-photo', {
      cpf: removePhotoCpf,
    })
  }

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase text-muted-foreground">BRGO · Goiana</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Colaboradores</h1>
            <p className="text-sm text-muted-foreground">
              Gestão rápida dos colaboradores registrados nos 2 relógios da planta BRGO em Goiana.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-2xl border border-border bg-white text-sm font-semibold text-muted-foreground hover:bg-secondary">
              Importar CSV
            </Button>
            <Button className="rounded-2xl border border-border bg-card px-6 text-sm font-semibold text-foreground hover:bg-secondary">
              Fluxo em lote
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Cadastro</p>
            <h2 className="text-xl font-semibold">Adicionar colaborador</h2>
            <p className="text-sm text-muted-foreground">
              Use os campos abaixo para registrar novos colaboradores BRGO.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitNewUser} className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-[11px] uppercase text-muted-foreground">Código interno</label>
                <input
                  type="number"
                  value={newUser.code}
                  onChange={handleFormChange('code')}
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="112233"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-[11px] uppercase text-muted-foreground">Nome completo</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={handleFormChange('name')}
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="Mauro Lima"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-[11px] uppercase text-muted-foreground">CPF</label>
                <input
                  type="text"
                  value={newUser.cpf}
                  onChange={handleFormChange('cpf')}
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="2233445548"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-[11px] uppercase text-muted-foreground">Registro / Matrícula</label>
                <input
                  type="text"
                  value={newUser.registration}
                  onChange={handleFormChange('registration')}
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="112233"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-[11px] uppercase text-muted-foreground">RFID</label>
                <input
                  type="text"
                  value={newUser.rfid}
                  onChange={handleFormChange('rfid')}
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="1234"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-[11px] uppercase text-muted-foreground">Senha (opcional)</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={handleFormChange('password')}
                  className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  placeholder="••••"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-border bg-background/60 p-4">
            <div className="grid gap-2 text-xs uppercase text-muted-foreground">
              <span className="text-[11px]">Tipo de acesso</span>
              <button
                type="button"
                onClick={handleAdminToggle}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${newUser.admin ? 'border-primary text-primary' : 'border-border/60 text-muted-foreground'}`}
              >
                {newUser.admin ? 'Administrador' : 'Usuário padrão'}
              </button>
            </div>
            <div className="grid gap-2">
              <label className="text-[11px] uppercase text-muted-foreground">Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={addActionRunning}
                className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
              {newUserPreview ? (
                <img
                  src={newUserPreview}
                  alt="Prévia do colaborador"
                  className="h-28 w-full rounded-2xl border border-border object-cover"
                />
              ) : (
                <p className="text-xs text-muted-foreground">A foto será enviada para validação assim que o backend estiver ativo.</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={addActionRunning}
              className="w-full rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {addActionRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingIndicator size="sm" label="Cadastrando nos relógios" />
                  Cadastrando nos relógios...
                </span>
              ) : (
                'Cadastrar nos relógios'
              )}
            </Button>
            {newUserError ? <ErrorIndicator message={newUserError} size="sm" className="justify-center text-xs" /> : null}
          </div>
        </form>
      </section>

      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Remoção</p>
            <h2 className="text-xl font-semibold">Excluir colaborador por CPF</h2>
            <p className="text-sm text-muted-foreground">Informe o CPF para remover um colaborador específico.</p>
          </div>
        </div>
        <form onSubmit={handleDeleteUser} className="mt-6 flex flex-wrap items-center gap-4">
          <input
            type="text"
            value={deleteCpf}
            onChange={(event) => setDeleteCpf(event.target.value)}
            placeholder="CPF para exclusão"
            className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <Button
            type="submit"
            variant="destructive"
            disabled={deleteActionRunning}
            className="rounded-2xl px-6 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmar exclusão
          </Button>
        </form>
      </section>

      <section className="rounded-[28px] border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Listagem</p>
            <h2 className="text-xl font-semibold">Colaboradores sincronizados</h2>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="text-xs">
              {totalStatus === 'error' && totalError ? (
                <ErrorIndicator message={totalError} size="sm" className="text-xs" />
              ) : totalStatus === 'loading' || totalStatus === 'idle' ? (
                <LoadingIndicator size="sm" label="Atualizando contagem" className="text-muted-foreground" />
              ) : (
                <span className="uppercase text-muted-foreground">{countSummaryText}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {listStatus === 'error' && listError ? (
                <ErrorIndicator message={listError} size="sm" className="text-xs" />
              ) : isLoadingUsers ? (
                <LoadingIndicator size="sm" label="Atualizando lista" className="text-xs uppercase" />
              ) : (
                <span className="text-xs uppercase text-muted-foreground">Atualizado</span>
              )}
              <Button
                variant="outline"
                onClick={handleRefreshList}
                disabled={isLoadingUsers}
                className="rounded-2xl border border-border bg-white text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
              >
                {isLoadingUsers ? (
                  <span className="flex items-center gap-2">
                    <LoadingIndicator size="sm" label="Atualizando lista" />
                    Atualizando lista
                  </span>
                ) : (
                  'Atualizar lista'
                )}
              </Button>
            </div>
          </div>
        </header>
        {isLoadingUsers && users.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <span className="inline-flex items-center justify-center gap-2">
              <LoadingIndicator size="sm" label="Sincronizando colaboradores BRGO" />
              Colaboradores BRGO em sincronização...
            </span>
          </div>
        ) : null}
        {listStatus === 'success' && users.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum colaborador retornado pelo REP master (192.168.200.10).</div>
        ) : null}
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[2fr,1.3fr,1fr,0.8fr,1fr,0.9fr] gap-4 border-b border-border px-6 py-3 text-[11px] uppercase text-muted-foreground">
              <span>Nome</span>
              <span>CPF</span>
              <span>Matrícula</span>
              <span>Face</span>
              <span>RFID</span>
              <span className="text-right">Ações</span>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {displayedUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Nenhum colaborador para exibir.</div>
              ) : (
                displayedUsers.map((user) => (
                  <div key={user.uid} className="grid grid-cols-[2fr,1.3fr,1fr,0.8fr,1fr,0.9fr] gap-4 border-b border-border px-6 py-4 text-sm text-foreground">
                  <div className="space-y-1">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">ID {user.uid}</p>
                  </div>
                  <div className="font-mono text-sm">{user.cpf ?? '--'}</div>
                  <div className="font-mono text-sm">{user.registration ?? '--'}</div>
                  <div className="flex items-center text-xs">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${
                        user.hasFace ? 'bg-emerald-100 text-emerald-700' : 'bg-border text-muted-foreground'
                      }`}
                    >
                      {user.hasFace ? 'OK' : 'Sem face'}
                    </span>
                  </div>
                  <div className="font-mono text-sm">{user.rfid ?? '--'}</div>
                  <div className="flex items-center justify-end gap-2 text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                      onClick={() => openEditModal(user)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void handleDeleteFromList(user)
                      }}
                      disabled={deleteActionRunning}
                      className="flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Remover
                    </Button>
                  </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-center border-t border-border px-6 py-4">
              <Button
                onClick={handleLoadMore}
                disabled={loadMoreDisabled || loadMoreBusy}
                className={`rounded-2xl border border-border px-6 text-sm font-semibold transition-colors ${
                  loadMoreDisabled
                    ? 'cursor-not-allowed bg-muted text-muted-foreground'
                    : 'bg-card text-foreground hover:bg-secondary'
                } ${loadMoreBusy ? 'opacity-80' : ''}`}
              >
                {loadMoreBusy ? (
                  <span className="flex items-center gap-2">
                    <LoadingIndicator size="sm" label="Sincronizando lista" />
                    Sincronizando lista
                  </span>
                ) : (
                  loadMoreLabel
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
      {isEditModalOpen && editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-border bg-card p-6 shadow-2xl">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Editar colaborador</p>
                <h3 className="text-2xl font-semibold text-foreground">{editingUser.name}</h3>
                <p className="text-sm text-muted-foreground">
                  CPF {editingUser.cpf ?? '---'} · ID {editingUser.uid}
                </p>
                {editingUser.hasFace ? (
                  <p className="mt-2 text-xs text-amber-600">
                    Este usuário já possui foto ativa no REP. Carregue um novo arquivo em "Atualizar foto" para substituir.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nenhuma foto cadastrada ainda. Use a seção abaixo para enviar a primeira imagem.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={closeEditModal}
                disabled={isActionRunning}
                className="rounded-2xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Fechar
              </Button>
            </header>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-[28px] border border-border bg-background/60 p-5">
                <form onSubmit={handleSubmitEditUser} className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Atualizar dados gerais</p>
                    <p className="text-sm text-muted-foreground">Atualiza todos os relógios BRGO ao mesmo tempo.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-[11px] uppercase text-muted-foreground">CPF</label>
                      <input
                        type="text"
                        value={editForm.cpf}
                        onChange={handleEditFormChange('cpf')}
                        className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        placeholder="2233445548"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] uppercase text-muted-foreground">Nome completo</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={handleEditFormChange('name')}
                        className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        placeholder="Jesse Pinkman"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] uppercase text-muted-foreground">Matrícula / Bars</label>
                      <input
                        type="text"
                        value={editForm.bars}
                        onChange={handleEditFormChange('bars')}
                        className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        placeholder="1345674"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] uppercase text-muted-foreground">Código interno</label>
                      <input
                        type="text"
                        value={editForm.code}
                        onChange={handleEditFormChange('code')}
                        className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        placeholder="112233"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] uppercase text-muted-foreground">RFID</label>
                      <input
                        type="text"
                        value={editForm.rfid}
                        onChange={handleEditFormChange('rfid')}
                        className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        placeholder="1007524"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] uppercase text-muted-foreground">Senha</label>
                      <input
                        type="password"
                        value={editForm.password}
                        onChange={handleEditFormChange('password')}
                        className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                        placeholder="••••"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/60 px-4 py-3 text-sm">
                    <span className="text-xs uppercase text-muted-foreground">Admin</span>
                    <button
                      type="button"
                      onClick={handleEditToggleAdmin}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${editForm.admin ? 'border-primary text-primary' : 'border-border/60 text-muted-foreground'}`}
                    >
                      {editForm.admin ? 'Administrador' : 'Usuário padrão'}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    disabled={isActionRunning}
                    className="w-full rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Atualizar nos relógios
                  </Button>
                </form>
              </div>

              <div className="space-y-4">
                <form onSubmit={handleSubmitPhotoUpdate} className="space-y-4 rounded-[28px] border border-border bg-background/60 p-5">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Atualizar foto</p>
                    <p className="text-sm text-muted-foreground">Envia a nova foto para os dois relógios BRGO.</p>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] uppercase text-muted-foreground">CPF</label>
                    <input
                      type="text"
                      value={photoForm.cpf}
                      onChange={handlePhotoCpfChange}
                      className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                      placeholder="2233445548"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] uppercase text-muted-foreground">Nova foto</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      disabled={isActionRunning}
                      className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-secondary-foreground disabled:cursor-not-allowed"
                    />
                    {photoImagePreview ? (
                      <img src={photoImagePreview} alt="Prévia da nova foto" className="h-28 w-full rounded-2xl border border-border object-cover" />
                    ) : (
                      <p className="text-xs text-muted-foreground">Selecione uma imagem JPG/PNG para gerar o base64 automaticamente.</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isActionRunning}
                    className="w-full rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Enviar foto aos relógios
                  </Button>
                </form>

                <form onSubmit={handleRemovePhoto} className="space-y-4 rounded-[28px] border border-border bg-background/40 p-5">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">Remover foto</p>
                    <p className="text-sm text-muted-foreground">Remove a foto atual registrada nos relógios.</p>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] uppercase text-muted-foreground">CPF</label>
                    <input
                      type="text"
                      value={removePhotoCpf}
                      onChange={(event) => setRemovePhotoCpf(event.target.value)}
                      className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                      placeholder="2233445548"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isActionRunning}
                    className="w-full rounded-2xl disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Remover foto dos relógios
                  </Button>
                </form>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {actionState.status === 'error' && actionState.error ? (
                <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4">
                  <p className="text-[11px] uppercase text-red-600">Não foi possível concluir essa ação</p>
                  <p className="mt-1 text-sm font-semibold text-red-700">{actionState.error}</p>
                </div>
              ) : null}

              {actionState.report ? (
                <div className="space-y-4 rounded-[28px] border border-border bg-background/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Relatório de execução</p>
                      <p className="text-sm text-muted-foreground">
                        {ACTION_LABELS[actionState.report.action]} · {actionState.report.success} de {actionState.report.total} relógios concluídos ·{' '}
                        {actionState.report.failure} falhas
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {reportTimestamp ? <span>{reportTimestamp}</span> : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDismissReport}
                        className="rounded-2xl px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                      >
                        Ocultar
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="text-[11px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Relógio</th>
                          <th className="px-3 py-2 text-left font-semibold">Status</th>
                          <th className="px-3 py-2 text-left font-semibold">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionState.report.results.map((result) => (
                          <tr key={result.clockId} className="border-t border-border text-sm">
                            <td className="px-3 py-2">
                              <p className="font-semibold text-foreground">{result.clockLabel}</p>
                              <p className="text-xs text-muted-foreground">{result.ip}</p>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${result.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                              >
                                {result.ok ? 'OK' : 'Erro'}
                              </span>
                              <p className="mt-1 text-[11px] uppercase text-muted-foreground">Tentativas {result.attempts}</p>
                            </td>
                            <td className="px-3 py-2 text-sm text-muted-foreground">
                              {result.message ?? 'Sem detalhes'}
                              {typeof result.statusCode === 'number' ? (
                                <span className="ml-2 text-[11px] uppercase text-muted-foreground/80">HTTP {result.statusCode}</span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            {isActionRunning ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[32px] bg-white/85 backdrop-blur">
                <LoadingIndicator size="lg" label="Sincronizando com os relógios" iconClassName="h-10 w-10" className="text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">{actionHeadline}</p>
                <p className="text-xs text-muted-foreground">Sincronizando com os relógios BRGO...</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showActionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-[32px] border border-border bg-card p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Ação em progresso</p>
                <h3 className="text-2xl font-semibold text-foreground">{actionHeadline}</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={resetActionState}
                disabled={modalIsRunning}
                className="rounded-2xl px-4 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fechar
              </Button>
            </div>

            <div className="mt-6">
              {modalIsRunning ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <LoadingIndicator size="lg" label="Sincronizando com os relógios BRGO" className="text-primary" />
                  <p className="text-sm text-muted-foreground">Sincronizando com os relógios BRGO...</p>
                </div>
              ) : modalError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm">
                  <ErrorIndicator message={modalError} size="sm" />
                </div>
              ) : modalReport ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <p>
                      {modalReport.success} de {modalReport.total} relógios concluíram · {modalReport.failure} falharam
                    </p>
                    <span className="text-xs uppercase">{new Date(modalReport.generatedAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="text-[11px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Relógio</th>
                          <th className="px-3 py-2 text-left font-semibold">Status</th>
                          <th className="px-3 py-2 text-left font-semibold">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalReport.results.map((result) => (
                          <tr key={result.clockId} className="border-t border-border">
                            <td className="px-3 py-2">
                              <p className="font-semibold text-foreground">{result.clockLabel}</p>
                              <p className="text-xs text-muted-foreground">{result.ip}</p>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${result.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                              >
                                {result.ok ? 'OK' : 'Erro'}
                              </span>
                              <p className="mt-1 text-[11px] uppercase text-muted-foreground">Tentativas {result.attempts}</p>
                            </td>
                            <td className="px-3 py-2 text-sm text-muted-foreground">{result.message ?? 'Sem detalhes'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function mapApiUserToClockUser(user: any, index: number): ClockUser {
  const safeName = typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : `Usuário ${index + 1}`
  const uidCandidate = user?.uid ?? user?.id ?? user?.code ?? index
  return {
    uid: typeof uidCandidate === 'string' ? uidCandidate : String(uidCandidate ?? index),
    name: safeName,
    cpf: typeof user?.cpf === 'string' ? user.cpf : user?.cpf != null ? String(user.cpf) : null,
    registration:
      typeof user?.registration === 'string'
        ? user.registration
        : user?.registration != null
          ? String(user.registration)
          : null,
    rfid: typeof user?.rfid === 'string' ? user.rfid : user?.rfid != null ? String(user.rfid) : null,
    hasFace: Boolean(user?.hasFace),
  }
}

function sortUsersAlphabetically(list: ClockUser[]): ClockUser[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

function extractFriendlyActionError(raw: string | null | undefined): string | null {
  if (!raw) {
    return null
  }

  const trimmed = raw.trim()
  const jsonCandidate = parseJsonFromText(trimmed)
  if (jsonCandidate) {
    const friendly = pickFriendlyJsonMessage(jsonCandidate)
    if (friendly) {
      return friendly
    }
  }

  const cleaned = trimmed.replace(/^HTTP\s*\d+\s*:/i, '').trim()
  if (!cleaned) {
    return null
  }
  if (/^<!DOCTYPE/i.test(cleaned) || /^<html/i.test(cleaned)) {
    return null
  }
  return cleaned
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  if (start === -1) {
    return null
  }
  try {
    const slice = text.slice(start)
    return JSON.parse(slice)
  } catch {
    return null
  }
}

function pickFriendlyJsonMessage(payload: Record<string, unknown>): string | null {
  const keys = ['message', 'error', 'detail', 'description']
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

