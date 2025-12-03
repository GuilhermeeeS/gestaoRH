import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorIndicator, LoadingIndicator } from '@/components/ui/status-indicator'
import { API_BASE_URL } from '@/lib/api'
const EXPECTED_CLOCKS = 10

type CoilEntry = {
  id: string
  plant: string
  label: string
  ip: string
  coilPaper: number | null
  status: 'success' | 'error'
  attempts: number
  lastError: string | null
}

type CoilStatus = 'idle' | 'loading' | 'success' | 'error'

function formatUpdatedLabel(iso: string | null): string {
  if (!iso) {
    return 'Sem leitura registrada'
  }
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    })
    return `Atualizado em ${formatter.format(new Date(iso))}`
  } catch (error) {
    return 'Última atualização não disponível'
  }
}

export default function CoilsMonitorPage() {
  const [entries, setEntries] = useState<CoilEntry[]>([])
  const [status, setStatus] = useState<CoilStatus>('idle')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    setStatus('loading')
    setErrorMessage(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/coils`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Falha na API (${response.status})`)
      }
      const payload = await response.json()
      setEntries(Array.isArray(payload.data) ? payload.data : [])
      setUpdatedAt(typeof payload.generatedAt === 'string' ? payload.generatedAt : null)
      setStatus('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      setErrorMessage(message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const maxReference = useMemo(() => {
    return entries.reduce((highest, entry) => {
      if (typeof entry.coilPaper === 'number' && entry.coilPaper > highest) {
        return entry.coilPaper
      }
      return highest
    }, 0)
  }, [entries])

  const getPercent = useCallback(
    (value: number | null) => {
      if (value == null || maxReference <= 0) {
        return 0
      }
      return Math.max(0, Math.min(100, Math.round((value / maxReference) * 100)))
    },
    [maxReference]
  )

  const statusLabel = formatUpdatedLabel(updatedAt)
  const isLoading = status === 'loading'
  const showEmptyState = status === 'success' && entries.length === 0

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase text-muted-foreground">Bobinas · BRTA/BRGO</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Monitoramento de Bobinas</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={loadEntries}
              className="rounded-2xl border border-border bg-white px-6 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <span className="text-xs uppercase text-muted-foreground">{statusLabel}</span>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm">
          <ErrorIndicator message={`Falha ao consultar bobinas: ${errorMessage}`} size="sm" />
        </div>
      ) : null}

      {showEmptyState ? (
        <div className="rounded-[28px] border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhum relógio retornou dados de bobina ainda. Forçe uma atualização para iniciar a primeira leitura.
        </div>
      ) : null}

      {isLoading && entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-border bg-card p-10 text-muted-foreground">
          <LoadingIndicator size="md" label="Consultando bobinas" className="mb-3" />
          <p className="text-sm">Sincronizando bobinas dos {EXPECTED_CLOCKS} relógios configurados...</p>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const percent = getPercent(entry.coilPaper)
            const coilLabel = entry.coilPaper == null ? '--' : entry.coilPaper.toLocaleString('pt-BR')
            return (
              <article key={entry.id} className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      {entry.plant} · {entry.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{coilLabel}</p>
                    <p className="text-xs text-muted-foreground">Qtd. de bobina reportada pelo REP</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${
                      entry.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {entry.status === 'success' ? 'OK' : 'Erro'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-mono">{entry.ip}</span>
                  <span className="ml-2">Tentativas: {entry.attempts}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-secondary/50">
                  <div
                    className={`h-1.5 rounded-full ${entry.status === 'success' ? 'bg-primary' : 'bg-red-400'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {entry.status === 'error' && entry.lastError ? (
                  <ErrorIndicator message={entry.lastError} size="sm" className="mt-2 text-xs" />
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{percent}% da maior bobina registrada agora</p>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
