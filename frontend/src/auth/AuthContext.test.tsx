import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { usuario, isLoading, login, logout } = useAuth()
  if (isLoading) return <div>carregando</div>
  return (
    <div>
      <div data-testid="usuario">{usuario ? usuario.username : 'deslogado'}</div>
      <button onClick={() => login('produtor1', 'senha123')}>entrar</button>
      <button onClick={() => logout()}>sair</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('bootstrap bem-sucedido popula o contexto via refresh + me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('produtor1'))
  })

  it('bootstrap com refresh invalido deixa o contexto deslogado', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })) // refresh falha
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))
  })

  it('login popula o contexto a partir da resposta de /auth/login/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // bootstrap: sem sessao
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'token-2', user: { id: 1, username: 'produtor1' } }), {
          status: 200,
        }),
      ) // login
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))

    screen.getByText('entrar').click()

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('produtor1'))
  })

  it('logout limpa o contexto mesmo se a chamada ao backend falhar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      .mockRejectedValueOnce(new Error('network down')) // logout falha
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('produtor1'))

    screen.getByText('sair').click()

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))
  })
})
