import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiRequest, refreshAccessToken, setAccessToken } from '../lib/api-client'

type Usuario = { id: number; username: string }

type AuthState = {
  usuario: Usuario | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      try {
        await refreshAccessToken()
        const me = await apiRequest<Usuario>('/auth/me/')
        setUsuario(me)
      } catch {
        // Cookie de refresh ausente/expirado, ou /auth/me/ falhou por
        // qualquer motivo apos um refresh bem-sucedido - em ambos os
        // casos o resultado e o mesmo: nao ha sessao valida, mostrar login.
        setAccessToken(null)
        setUsuario(null)
      } finally {
        setIsLoading(false)
      }
    }
    bootstrap()
  }, [])

  async function login(username: string, password: string) {
    const data = await apiRequest<{ access: string; user: Usuario }>('/auth/login/', {
      method: 'POST',
      body: { username, password },
    })
    setAccessToken(data.access)
    setUsuario(data.user)
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout/', { method: 'POST' })
    } catch {
      // logout e idempotente no backend - mesmo se a chamada falhar (rede,
      // token ja expirado), o usuario deve sair da UI de qualquer forma.
    } finally {
      setAccessToken(null)
      setUsuario(null)
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider')
  }
  return context
}
