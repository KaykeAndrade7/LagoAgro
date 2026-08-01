import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()

  return (
    <div>
      <header className="flex items-center justify-between border-b p-4">
        <span className="font-bold">LagoAgro</span>
        <button onClick={() => logout()} className="text-sm">
          Sair
        </button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
