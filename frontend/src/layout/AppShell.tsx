import { useEffect, useState } from 'react'
import type { ReactNode, SVGProps } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { suportaPush, ativarNotificacoes } from '../lib/push'
import { promptDisponivel, assinarDisponibilidade, solicitarInstalacao } from '../lib/install-prompt'
import { Button } from '../components/ui'

type EstadoNotificacoes = 'idle' | 'carregando' | 'ativado' | 'negado' | 'indisponivel' | 'erro'

const linksNavegacao = [
  { to: '/', label: 'Painel', end: true },
  { to: '/propriedades', label: 'Propriedades' },
  { to: '/culturas', label: 'Culturas' },
  { to: '/plantios', label: 'Plantios' },
  { to: '/insumos', label: 'Insumos' },
  { to: '/aplicacoes', label: 'Aplicações' },
  { to: '/tarefas', label: 'Tarefas' },
  { to: '/colheitas', label: 'Colheitas' },
  { to: '/trabalhadores', label: 'Trabalhadores' },
  { to: '/financeiro', label: 'Financeiro' },
]

function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

function IconDownload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 4v11m0 0-4-4m4 4 4-4" />
      <path d="M5 18h14v2H5z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()
  const [estadoNotificacoes, setEstadoNotificacoes] = useState<EstadoNotificacoes>('idle')
  const [instalacaoDisponivel, setInstalacaoDisponivel] = useState(promptDisponivel())

  useEffect(() => {
    setInstalacaoDisponivel(promptDisponivel())
    return assinarDisponibilidade(() => setInstalacaoDisponivel(promptDisponivel()))
  }, [])

  async function aoClicarAtivarNotificacoes() {
    setEstadoNotificacoes('carregando')
    try {
      const resultado = await ativarNotificacoes()
      setEstadoNotificacoes(resultado)
    } catch {
      setEstadoNotificacoes('erro')
    }
  }

  async function aoClicarInstalar() {
    try {
      await solicitarInstalacao()
    } finally {
      setInstalacaoDisponivel(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/logo-fonte.svg" alt="" className="h-8 w-8 rounded-md" />
            <span className="font-display text-lg font-black uppercase tracking-tight text-ink">LagoAgro</span>
          </NavLink>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {instalacaoDisponivel && (
              <Button variant="ghost" size="sm" className="normal-case" onClick={aoClicarInstalar}>
                <IconDownload className="h-4 w-4" /> Instalar app
              </Button>
            )}
            {suportaPush() && estadoNotificacoes !== 'ativado' && (
              <Button
                variant="ghost"
                size="sm"
                className="normal-case"
                onClick={aoClicarAtivarNotificacoes}
                disabled={estadoNotificacoes === 'carregando'}
              >
                <IconBell className="h-4 w-4" />
                {estadoNotificacoes === 'carregando' ? 'Ativando…' : 'Ativar notificações'}
              </Button>
            )}
            {estadoNotificacoes === 'ativado' && (
              <span className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-accent">
                <IconBell className="h-4 w-4" /> Notificações ativadas
              </span>
            )}
            <Button variant="ghost" size="sm" className="normal-case" onClick={() => logout()}>
              Sair
            </Button>
          </div>
        </div>

        {(estadoNotificacoes === 'negado' || estadoNotificacoes === 'indisponivel' || estadoNotificacoes === 'erro') && (
          <p className="px-4 pb-2 text-sm font-semibold text-rust">
            {estadoNotificacoes === 'negado' && 'Permissão negada — ative nas configurações do navegador.'}
            {estadoNotificacoes === 'indisponivel' && 'Notificações indisponíveis neste ambiente.'}
            {estadoNotificacoes === 'erro' && 'Não foi possível ativar notificações agora.'}
          </p>
        )}

        <nav aria-label="Navegação principal" className="dashed-divider overflow-x-auto px-3 py-2">
          <ul className="flex gap-1.5">
            {linksNavegacao.map((link) => (
              <li key={link.to} className="shrink-0">
                <NavLink to={link.to} end={link.end} className={({ isActive }) => cxNav(isActive)}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}

function cxNav(isActive: boolean): string {
  return [
    'block whitespace-nowrap rounded-full border-2 px-3.5 py-2 font-display text-sm font-bold',
    isActive ? 'border-ink bg-accent text-accent-contrast' : 'border-line bg-paper text-ink-soft',
  ].join(' ')
}
