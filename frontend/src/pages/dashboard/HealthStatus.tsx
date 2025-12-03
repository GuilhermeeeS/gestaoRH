import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorIndicator, LoadingIndicator } from '@/components/ui/status-indicator'
import { API_BASE_URL } from '@/lib/api'

type ClockStatus = {
  id: string
  plant: string
  label: string
  ip: string
  status: 'online' | 'offline'
  attempts: number
  lastError: string | null
}

const statusColor: Record<ClockStatus['status'], string> = {
  online: 'bg-emerald-500/15 text-emerald-800',
  offline: 'bg-red-100 text-red-800',
}

const statusLabel: Record<ClockStatus['status'], string> = {
  online: 'Ativo',
  offline: 'Offline',
}

export default function HealthStatusPage() {
  const [clocks, setClocks] = useState<ClockStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const loadStatuses = useCallback(async (opts?: { skipLoading?: boolean }) => {
    if (!opts?.skipLoading) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      setError(null)
      const response = await fetch(`${API_BASE_URL}/api/clocks/status`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Falha na API (${response.status})`)
      }
      const payload = await response.json()
      setClocks(payload.data ?? [])
      setLastUpdated(payload.generatedAt ?? new Date().toISOString())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadStatuses()
    const interval = setInterval(() => loadStatuses({ skipLoading: true }), 60_000)
    return () => clearInterval(interval)
  }, [loadStatuses])

  const summary = useMemo(() => {
    const total = clocks.length
    const online = clocks.filter((clock) => clock.status === 'online').length
    const offline = clocks.filter((clock) => clock.status === 'offline').length
    return { total, online, offline }
  }, [clocks])

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase text-muted-foreground">Monitoramento · Control ID</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Status dos Relógios</h1>
            <p className="text-sm text-muted-foreground">
              Visão em tempo quase real da conectividade individual de cada REP.
              {lastUpdated ? ` Última atualização: ${new Date(lastUpdated).toLocaleTimeString('pt-BR')}` : ''}
            </p>
            {error ? <ErrorIndicator message={error} size="sm" className="mt-2 text-sm" /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => loadStatuses({ skipLoading: true })}
              disabled={isRefreshing}
              className="rounded-2xl border border-border bg-card px-6 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {isRefreshing ? (
                <span className="flex items-center gap-2">
                  <LoadingIndicator size="sm" label="Atualizando status" />
                  Atualizando status
                </span>
              ) : (
                'Reexecutar ping'
              )}
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase text-muted-foreground">Relógios ativos</p>
          <p className="mt-3 text-2xl font-semibold text-foreground">{summary.online}</p>
          <p className="text-sm text-muted-foreground">Respondendo aos logins</p>
        </article>
        <article className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase text-muted-foreground">Monitorados</p>
          <p className="mt-3 text-2xl font-semibold text-foreground">{summary.total}</p>
          <p className="text-sm text-muted-foreground">Total de relógios cadastrados</p>
        </article>
        <article className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase text-muted-foreground">Offline</p>
          <p className="mt-3 text-2xl font-semibold text-foreground">{summary.offline}</p>
          <p className="text-sm text-muted-foreground">Sem resposta após 2 tentativas</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Lista completa</p>
            <h2 className="text-xl font-semibold">Replicadores BRTA · BRGO</h2>
          </div>
          <div className="text-xs uppercase text-muted-foreground">
            {loading ? <LoadingIndicator size="sm" label="Atualizando status" className="text-muted-foreground" /> : 'Atualização em tempo real'}
          </div>
        </header>
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <span className="inline-flex items-center justify-center gap-2">
              <LoadingIndicator size="sm" label="Sincronizando status" />
              Status sendo sincronizados...
            </span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {clocks.map((clock) => (
              <article key={clock.id} className="grid gap-3 px-6 py-4 sm:grid-cols-[1.3fr_1fr_1fr_0.8fr_0.8fr] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-foreground">{clock.label}</p>
                  <p className="text-xs text-muted-foreground">{clock.plant}</p>
                </div>
                <p className="text-sm font-mono text-muted-foreground">{clock.ip}</p>
                <p className="text-xs text-muted-foreground">Tentativas: {clock.attempts}</p>
                <p className="text-xs text-muted-foreground">{clock.lastError ? `Erro: ${clock.lastError}` : 'Operacional'}</p>
                <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor[clock.status]}`}>
                  {statusLabel[clock.status]}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
