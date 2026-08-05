import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from './DashboardPage'
import * as tarefasApi from '../api/tarefas'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as authContext from '../auth/AuthContext'
import { ApiError } from '../lib/api-client'

vi.mock('../api/tarefas')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../auth/AuthContext')

const plantioTalhao1 = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const plantioTalhao2 = { id: 2, talhao: 2, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao1 = { id: 1, propriedade: 1, nome: 'Talhao A', area: '1.00', tipo_solo: 'argiloso' }
const talhao2 = { id: 2, propriedade: 1, nome: 'Talhao B', area: '1.00', tipo_solo: 'arenoso' }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: { id: 1, username: 'produtor1' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantioTalhao1, plantioTalhao2])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao1, talhao2])
    // shouldAdvanceTime: true faz o relogio falso avancar em tempo real (a partir do
    // instante fixado por setSystemTime), o que e necessario pro polling interno do
    // waitFor/findBy* do testing-library funcionar — sem isso, @testing-library/dom so
    // detecta "fake timers" checando um global `jest`, que o vitest nao define; o
    // waitFor entao chama setInterval/setTimeout (que estao mockados) e eles nunca
    // disparam, travando todo findByText ate o timeout do proprio vitest.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra a saudacao com o nome do usuario', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText(/Bem-vindo, produtor1/)).toBeInTheDocument()
  })

  it('agrupa tarefas pendentes por talhao', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false },
      { id: 2, plantio: 2, descricao: 'Regar B', data: '2026-08-05', concluida: false },
    ])

    renderComProvider()

    expect(await screen.findByText('Talhao A')).toBeInTheDocument()
    expect(screen.getByText('Talhao B')).toBeInTheDocument()
    expect(screen.getByText(/Regar A/)).toBeInTheDocument()
    expect(screen.getByText(/Regar B/)).toBeInTheDocument()
  })

  it('talhao sem tarefa pendente nao aparece', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false },
    ])

    renderComProvider()

    await screen.findByText('Talhao A')
    expect(screen.queryByText('Talhao B')).not.toBeInTheDocument()
  })

  it('tarefa concluida nao aparece no painel', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Ja feita', data: '2026-08-01', concluida: true },
    ])

    renderComProvider()

    await screen.findByText(/Bem-vindo/)
    expect(screen.queryByText(/Ja feita/)).not.toBeInTheDocument()
  })

  it('nenhuma tarefa pendente mostra mensagem vazia', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText('Nenhuma tarefa pendente.')).toBeInTheDocument()
  })

  it('tarefa atrasada aparece com destaque visual', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Atrasada', data: '2026-08-01', concluida: false },
    ])

    renderComProvider()

    expect((await screen.findAllByText(/Atrasada/))[0].className).toContain('text-rust')
  })

  it('checkbox no painel marca tarefa como concluida', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([])
    vi.mocked(tarefasApi.alterarConclusao).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Regar A',
      data: '2026-08-05',
      concluida: true,
    })

    renderComProvider()
    await screen.findByText(/Regar A/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(vi.mocked(tarefasApi.alterarConclusao)).toHaveBeenCalledWith(1, true)
  })

  it('erro ao marcar conclusao aparece como mensagem inline', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false },
    ])
    vi.mocked(tarefasApi.alterarConclusao).mockRejectedValue(new ApiError(500, 'Erro interno do servidor.', {}))

    renderComProvider()
    await screen.findByText(/Regar A/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
