import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { usuario } = useAuth()

  return <p>Bem-vindo, {usuario?.username}</p>
}
