import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext'
import { apiRequest, AuthExpiredError } from '../lib/api-client'

function Probe() {
  const { usuario, isLoading, login, logout } = useAuth()
  const [probeError, setProbeError] = useState<string | null>(null)
  if (isLoading) return <div>carregando</div>
  return (
    <div>
      <div data-testid="usuario">{usuario ? usuario.username : 'deslogado'}</div>
      <button onClick={() => login('produtor1', 'senha123')}>entrar</button>
      <button onClick={() => logout()}>sair</button>
      <button
        onClick={() =>
          apiRequest('/algum-endpoint-protegido/').catch((error: unknown) =>
            setProbeError(error instanceof AuthExpiredError ? 'AuthExpiredError' : 'outro erro'),
          )
        }
      >
        chamar protegido
      </button>
      {probeError && <div data-testid="probe-error">{probeError}</div>}
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

    await userEvent.click(screen.getByText('entrar'))

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

    await userEvent.click(screen.getByText('sair'))

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))
  })

  it('AuthExpiredError fora do bootstrap (ex.: chamada de dominio futura) limpa o contexto', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh do bootstrap
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me do bootstrap
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // chamada protegida: 401
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // refresh dessa chamada: tambem falha
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('produtor1'))

    await userEvent.click(screen.getByText('chamar protegido'))

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))
    expect(screen.getByTestId('probe-error')).toHaveTextContent('AuthExpiredError')
  })
})
