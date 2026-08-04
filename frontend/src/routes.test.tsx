import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { router } from './routes'

describe('roteamento', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    // routes.tsx cria `router` com createBrowserRouter no escopo do modulo,
    // entao a localizacao efetiva do router (router.state.location) persiste
    // entre os `it()` deste arquivo, ja que todos importam o mesmo
    // `App`/`router`. window.history.pushState() sozinho NAO resincroniza
    // essa localizacao interna do react-router (ele so escuta 'popstate' ou
    // chamadas explicitas a router.navigate()), entao o reset precisa passar
    // pela API real do router para isolar os testes de verdade.
    await router.navigate('/')
  })

  it('usuario deslogado tentando ver o dashboard e redirecionado pro login', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })) // bootstrap falha
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument())
  })

  it('login bem-sucedido leva ao dashboard com o nome do usuario', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // bootstrap: sem sessao
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'token-2', user: { id: 1, username: 'produtor1' } }), {
          status: 200,
        }),
      ) // login
      // DashboardPage dispara 3 fetches paralelos (tarefas/plantios/talhoes).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument())

    await user.type(screen.getByLabelText('Usuário'), 'produtor1')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())
  })

  it('logout volta pro login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // DashboardPage dispara 3 fetches paralelos (tarefas/plantios/talhoes) antes do logout.
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument())
  })
})

describe('navegacao para as paginas de cadastro', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await router.navigate('/')
  })

  it('link de Propriedades navega para a pagina de propriedades', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // PropriedadesPage dispara 3 fetches paralelos (propriedades/talhoes/plantios); um
      // unico objeto Response nao pode ser lido (.json()) mais de uma vez, entao usamos
      // mockImplementation pra devolver uma Response nova a cada chamada em vez de
      // mockResolvedValue (que reaproveitaria a mesma instancia e quebraria o body stream
      // das chamadas concorrentes).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 })) // propriedades/talhoes/plantios
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Propriedades' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Propriedades' })).toBeInTheDocument())
  })

  it('link de Culturas navega para a pagina de culturas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 })) // culturas
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Culturas' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Culturas' })).toBeInTheDocument())
  })

  it('link de Plantios navega para a pagina de plantios', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // PlantiosPage tambem dispara 3 fetches paralelos (plantios/talhoes/culturas); mesmo
      // motivo do teste de Propriedades acima: mockImplementation evita reusar a mesma
      // instancia de Response entre chamadas concorrentes.
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 })) // plantios/talhoes/culturas
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Plantios' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plantios' })).toBeInTheDocument())
  })

  it('link de Insumos navega para a pagina de insumos', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // InsumosPage dispara 2 fetches paralelos (insumos/aplicacoes); mesmo motivo dos
      // testes de Propriedades/Plantios acima: mockImplementation evita reusar a mesma
      // instancia de Response entre chamadas concorrentes.
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 })) // insumos/aplicacoes
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Insumos' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Insumos' })).toBeInTheDocument())
  })

  it('link de Aplicacoes navega para a pagina de aplicacoes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // AplicacoesPage dispara 5 fetches paralelos (aplicacoes/plantios/talhoes/culturas/insumos).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Aplicações' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Aplicações' })).toBeInTheDocument())
  })

  it('link de Tarefas navega para a pagina de tarefas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // TarefasPage dispara 4 fetches paralelos (tarefas/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Tarefas' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tarefas' })).toBeInTheDocument())
  })

  it('link de Colheitas navega para a pagina de colheitas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // ColheitasPage dispara 4 fetches paralelos (colheitas/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Colheitas' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Colheitas' })).toBeInTheDocument())
  })

  it('link de Trabalhadores navega para a pagina de trabalhadores', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // TrabalhadoresPage dispara 5 fetches paralelos (trabalhadores/diarias/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Trabalhadores' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trabalhadores' })).toBeInTheDocument())
  })

  it('link de Financeiro navega para a pagina de financeiro', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // FinanceiroPage dispara 5 fetches paralelos (lancamentos/diarias/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Financeiro' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument())
  })
})
