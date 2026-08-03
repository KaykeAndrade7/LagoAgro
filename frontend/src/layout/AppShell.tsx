import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()

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
          </nav>
        </div>
        <button onClick={() => logout()} className="text-sm">
          Sair
        </button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
