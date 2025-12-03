import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorIndicator, LoadingIndicator } from '@/components/ui/status-indicator'
import { API_BASE_URL } from '@/lib/api'

const plants = [
  {
    code: 'BRTA',
    label: 'Taubaté · SP',
    devices: 8,
    network: '192.168.100.10 - 192.168.100.17',
    accent: 'bg-[#d7263d]',
  },
  {
    code: 'BRGO',
    label: 'Goiana · PE',
    devices: 2,
    network: '192.168.200.10 · 192.168.200.11',
    accent: 'bg-[#c4323c]',
  },
]

type SummaryStatus = 'idle' | 'loading' | 'success' | 'error'

type ClockSummaryState = {
  status: SummaryStatus
  online: number
  total: number
  error: string | null
}

type UserSummaryState = {
  status: SummaryStatus
  count: number
  generatedAt: string | null
  error: string | null
}

const initialClockSummary: ClockSummaryState = {
  status: 'idle',
  online: 0,
  total: 0,
  error: null,
}

const initialUserSummary: UserSummaryState = {
  status: 'idle',
  count: 0,
  generatedAt: null,
  error: null,
}

function getStatusIcon(status: SummaryStatus) {
  if (status === 'success') {
    return <CheckCircle2 className="h-6 w-6 text-emerald-500" />
  }
  if (status === 'error') {
    return <XCircle className="h-6 w-6 text-red-500" />
  }
  return <LoadingIndicator size="md" className="text-muted-foreground" />
}

function formatUserValue(summary: UserSummaryState): string {
  if (summary.status === 'success') {
    return summary.count.toLocaleString('pt-BR')
  }
  if (summary.status === 'error') {
    return '--'
  }
  return '---'
}

function formatTimestampLabel(iso: string): string {
  try {
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
    return `às ${time}`
  } catch (error) {
    return ''
  }
}

function getUserSubtext(summary: UserSummaryState): string {
  if (summary.status === 'success' && summary.generatedAt) {
    const label = formatTimestampLabel(summary.generatedAt)
    return label ? `Última leitura ${label}` : 'Última leitura registrada'
  }
  if (summary.status === 'error') {
    return 'Falha ao consultar'
  }
  return 'Consultando...'
}

export default function DashboardOverview() {
  const [clockSummary, setClockSummary] = useState<ClockSummaryState>(initialClockSummary)
  const [brtaUsers, setBrtaUsers] = useState<UserSummaryState>(initialUserSummary)
  const [brgoUsers, setBrgoUsers] = useState<UserSummaryState>(initialUserSummary)

  const loadClockSummary = useCallback(async () => {
    setClockSummary((prev) => ({ ...prev, status: 'loading', error: null }))
    try {
      if (!API_BASE_URL) {
        throw new Error('Backend não configurado')
      }
      const response = await fetch(`${API_BASE_URL}/api/dashboard/overview/clocks`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Falha na API (${response.status})`)
      }
      const payload = await response.json()
      setClockSummary({
        status: 'success',
        online: payload.online ?? 0,
        total: payload.total ?? 0,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      setClockSummary({ status: 'error', online: 0, total: 0, error: message })
    }
  }, [])

  const loadBrtaUsers = useCallback(async () => {
    setBrtaUsers((prev) => ({ ...prev, status: 'loading', error: null }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/overview/users/brta`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Falha na API (${response.status})`)
      }
      const payload = await response.json()
      setBrtaUsers({
        status: 'success',
        count: Number(payload.count ?? 0),
        generatedAt: payload.generatedAt ?? null,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      setBrtaUsers({ status: 'error', count: 0, generatedAt: null, error: message })
    }
  }, [])

  const loadBrgoUsers = useCallback(async () => {
    setBrgoUsers((prev) => ({ ...prev, status: 'loading', error: null }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/overview/users/brgo`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Falha na API (${response.status})`)
      }
      const payload = await response.json()
      setBrgoUsers({
        status: 'success',
        count: Number(payload.count ?? 0),
        generatedAt: payload.generatedAt ?? null,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      setBrgoUsers({ status: 'error', count: 0, generatedAt: null, error: message })
    }
  }, [])

  useEffect(() => {
    loadClockSummary()
    loadBrtaUsers()
    loadBrgoUsers()
  }, [loadClockSummary, loadBrtaUsers, loadBrgoUsers])

  const clockValue = useMemo(() => {
    if (clockSummary.status === 'success') {
      return `${clockSummary.online}/${clockSummary.total}`
    }
    if (clockSummary.status === 'error') {
      return '--'
    }
    return '---'
  }, [clockSummary])

  const clockSubText = clockSummary.status === 'error' ? 'Falha ao consultar' : clockSummary.status === 'success' ? 'Monitoramento contínuo' : 'Consultando...'

  const clockIcon = useMemo(() => getStatusIcon(clockSummary.status), [clockSummary.status])
  const brtaIcon = useMemo(() => getStatusIcon(brtaUsers.status), [brtaUsers.status])
  const brgoIcon = useMemo(() => getStatusIcon(brgoUsers.status), [brgoUsers.status])

  const brtaValue = useMemo(() => formatUserValue(brtaUsers), [brtaUsers])
  const brgoValue = useMemo(() => formatUserValue(brgoUsers), [brgoUsers])
  const brtaSubText = useMemo(() => getUserSubtext(brtaUsers), [brtaUsers])
  const brgoSubText = useMemo(() => getUserSubtext(brgoUsers), [brgoUsers])

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Central Operacional</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Painel de Controle
            <br /> BRTA · BRGO
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-2xl border border-border bg-white px-6 text-sm font-semibold text-muted-foreground hover:bg-secondary"
          >
            Sincronizar Agora
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">Relógios Online</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{clockValue}</p>
              <p className="text-sm text-muted-foreground">{clockSubText}</p>
              {clockSummary.status === 'error' && clockSummary.error ? (
                <ErrorIndicator message={clockSummary.error} size="sm" className="mt-2 text-xs" />
              ) : null}
            </div>
            {clockIcon}
          </div>
        </article>
        <article className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">Usuários BRTA</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{brtaValue}</p>
              <p className="text-sm text-muted-foreground">{brtaSubText}</p>
              {brtaUsers.status === 'error' && brtaUsers.error ? (
                <ErrorIndicator message={brtaUsers.error} size="sm" className="mt-2 text-xs" />
              ) : null}
            </div>
            {brtaIcon}
          </div>
        </article>
        <article className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">Usuários BRGO</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{brgoValue}</p>
              <p className="text-sm text-muted-foreground">{brgoSubText}</p>
              {brgoUsers.status === 'error' && brgoUsers.error ? (
                <ErrorIndicator message={brgoUsers.error} size="sm" className="mt-2 text-xs" />
              ) : null}
            </div>
            {brgoIcon}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {plants.map((plant) => (
          <article key={plant.code} className="rounded-[28px] border border-border bg-card p-7 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">{plant.label}</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{plant.code}</h2>
              </div>
              <span className="rounded-full bg-secondary px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground">
                {plant.devices} REP
              </span>
            </div>
            <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Range</p>
                <p className="font-mono text-base">{plant.network}</p>
              </div>
              <Button
                variant="secondary"
                className="rounded-2xl border border-border bg-white text-foreground hover:bg-secondary"
              >
                Abrir detalhes
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-3 text-[11px] uppercase">
              <span className={`h-2 w-2 rounded-full ${plant.accent}`} />
              <span className="text-muted-foreground">Rede monitorada continuamente</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
