import { NavLink } from 'react-router-dom'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

export default function AppSidebar() {
  const { user } = useAuth()

  const navSections = useMemo(() => {
    const base = [
      {
        label: 'Operação',
        items: [
          { to: '/dashboard', title: 'Visão Geral', badge: 'LIVE', exact: true },
          { to: '/dashboard/health', title: 'Status dos Relógios', badge: '10' },
          { to: '/dashboard/coils', title: 'Bobinas · REP' },
        ],
      },
      {
        label: 'Colaboradores',
        items: [
          { to: '/dashboard/brta/employees', title: 'BRTA · Taubaté' },
          { to: '/dashboard/brgo/employees', title: 'BRGO · Goiana' },
        ],
      },
    ]

    if (user?.role === 'admin') {
      base.push({
        label: 'Administração',
        items: [{ to: '/dashboard/admin/users', title: 'Gestão de usuários', badge: 'ADMIN' }],
      })
    }

    return base
  }, [user?.role])

  return (
    <aside className="hidden w-72 flex-col border-r border-black/20 bg-[#0f1116] px-6 py-8 text-sm text-muted-foreground xl:flex">
      <div className="mb-10 space-y-1 text-white">
        <p className="text-xs uppercase text-primary">Control Station</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Central · ID</h1>
        <p className="text-[12px] uppercase text-muted-foreground">BRTA · BRGO</p>
      </div>

      <nav className="space-y-8">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-3">
            <p className="text-[0.72rem] uppercase text-muted-foreground">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact ?? false}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between rounded-2xl border border-transparent px-4 py-3 font-medium transition',
                      'text-muted-foreground hover:bg-white/5 hover:text-white',
                      isActive && 'bg-white/10 text-white border border-white/20'
                    )
                  }
                >
                  <span>{item.title}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold text-primary">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-[12px] text-white">
          <p className="font-semibold">Sincronização Manual</p>
          <p className="text-white/60">Forçar atualização com os 10 relógios ativos.</p>
        </div>
        <Button className="h-12 w-full rounded-2xl border border-white/10 bg-white/95 text-[#0f1116] hover:bg-white">
          Executar Scan
        </Button>
      </div>
    </aside>
  )
}
