import { Button } from '@/components/ui/button'
import AppSidebar from '@/components/layout/AppSidebar'

const plants = [
  {
    code: 'BRTA',
    label: 'Taubaté · SP',
    devices: 8,
    network: '192.168.100.10 - 192.168.100.17',
    accent: 'bg-[#d7263d]'
  },
  {
    code: 'BRGO',
    label: 'Goiana · PE',
    devices: 2,
    network: '192.168.200.10 · 192.168.200.11',
    accent: 'bg-[#c4323c]'
  },
]

const quickStats = [
  { label: 'Relógios Online', value: '10/10', sub: 'Monitoramento contínuo' },
  { label: 'Usuários Sincronizados', value: '1.284', sub: 'Última leitura 2m' },
  { label: 'Bobinas Monitoradas', value: '10', sub: 'Consulta por REP' },
]

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col space-y-8 px-6 py-10 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Central Operacional</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Painel de Controle<br /> BRTA · BRGO
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {quickStats.map((item) => (
            <article
              key={item.label}
              className="rounded-[24px] border border-border/70 bg-[#1a1d23] p-5"
            >
              <p className="text-[11px] uppercase text-muted-foreground">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{item.value}</p>
              <p className="text-sm text-muted-foreground">{item.sub}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {plants.map((plant) => (
            <article
              key={plant.code}
              className="rounded-[28px] border border-border/70 bg-[#1c1f26] p-7"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">{plant.label}</p>
                  <h2 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{plant.code}</h2>
                </div>
                <span className="rounded-full bg-[#2a2e37] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground">
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
                  className="rounded-2xl border border-border/70 bg-transparent text-foreground hover:bg-white/5"
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

        <section className="rounded-[28px] border border-border/70 bg-[#1a1d23] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">Fluxo em desenvolvimento</p>
              <h3 className="text-2xl font-semibold">Checklists · Certificados HTTPS · Sessões</h3>
            </div>
            <Button variant="outline" className="rounded-2xl border border-border/70 text-muted-foreground hover:bg-white/5">
              Adicionar Widget
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            A etapa de backend irá lidar com autenticação real (JWT + Prisma) e comunicação segura com os relógios. Esta tela
            mantém o layout moderno para acelerar o desenvolvimento das próximas features.
          </p>
        </section>
      </div>
    </div>
  )
}
