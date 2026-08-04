import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { suportaPush, ativarNotificacoes } from '../lib/push'

type EstadoNotificacoes = 'idle' | 'carregando' | 'ativado' | 'negado' | 'indisponivel' | 'erro'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()
  const [estadoNotificacoes, setEstadoNotificacoes] = useState<EstadoNotificacoes>('idle')

  async function aoClicarAtivarNotificacoes() {
    setEstadoNotificacoes('carregando')
    try {
      const resultado = await ativarNotificacoes()
      setEstadoNotificacoes(resultado)
    } catch {
      setEstadoNotificacoes('erro')
    }
  }

  return (
    <div>
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <span className="font-bold">LagoAgro</span>
          <nav className="flex gap-3 text-sm">
            <Link to="/">Painel</Link>
            <Link to="/propriedades">Propriedades</Link>
            <Link to="/culturas">Culturas</Link>
            <Link to="/plantios">Plantios</Link>
            <Link to="/insumos">Insumos</Link>
            <Link to="/aplicacoes">Aplicações</Link>
            <Link to="/tarefas">Tarefas</Link>
            <Link to="/colheitas">Colheitas</Link>
            <Link to="/trabalhadores">Trabalhadores</Link>
            <Link to="/financeiro">Financeiro</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {suportaPush() && estadoNotificacoes !== 'ativado' && (
            <button onClick={aoClicarAtivarNotificacoes} disabled={estadoNotificacoes === 'carregando'}>
              {estadoNotificacoes === 'carregando' ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}
          {estadoNotificacoes === 'ativado' && <span>Notificações ativadas</span>}
          {estadoNotificacoes === 'negado' && (
            <span className="text-red-600">Permissão negada — ative nas configurações do navegador.</span>
          )}
          {estadoNotificacoes === 'indisponivel' && (
            <span className="text-red-600">Notificações indisponíveis neste ambiente.</span>
          )}
          {estadoNotificacoes === 'erro' && (
            <span className="text-red-600">Não foi possível ativar notificações agora.</span>
          )}
          <button onClick={() => logout()}>Sair</button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
