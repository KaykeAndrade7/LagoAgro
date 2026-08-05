import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button, Card, Field, Input } from '../components/ui'

export function LoginPage() {
  const { login, usuario, isLoading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!isLoading && usuario) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch {
      setError('Usuário ou senha inválidos.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo-fonte.svg" alt="" className="h-14 w-14 rounded-xl" />
          <p className="font-display text-2xl font-black uppercase tracking-tight text-ink">LagoAgro</p>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Talão do produtor
          </p>
        </div>

        <Card className="ticket-paper p-6 pl-9">
          <h1 className="mb-5 font-display text-xl font-black uppercase tracking-tight text-ink">Entrar</h1>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Field id="username" label="Usuário">
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </Field>

            <Field id="password" label="Senha">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-md border-2 border-rust/30 bg-rust-bg px-3 py-2 text-sm font-bold text-rust">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
