import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { usuario, isLoading } = useAuth()

  if (isLoading) return null
  if (!usuario) return <Navigate to="/login" replace />

  return <>{children}</>
}
