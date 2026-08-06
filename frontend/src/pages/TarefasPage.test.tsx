import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TarefasPage } from './TarefasPage'
import * as tarefasApi from '../api/tarefas'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'
import { ApiError } from '../lib/api-client'

vi.mock('../api/tarefas')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [], somente_leitura: false }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TarefasPage />
    </QueryClientProvider>,
  )
}

describe('TarefasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
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

  it('lista por padrao so tarefas pendentes', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false },
      { id: 2, plantio: 1, descricao: 'Ja feita', data: '2026-08-01', concluida: true },
    ])

    renderComProvider()

    expect(await screen.findByText(/Regar/)).toBeInTheDocument()
    expect(screen.queryByText(/Ja feita/)).not.toBeInTheDocument()
  })

  it('"Ver concluidas" revela as tarefas concluidas', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false },
      { id: 2, plantio: 1, descricao: 'Ja feita', data: '2026-08-01', concluida: true },
    ])

    renderComProvider()
    await screen.findByText(/Regar/)

    await userEvent.click(screen.getByText('Ver concluídas'))

    expect(await screen.findByText(/Ja feita/)).toBeInTheDocument()
  })

  it('criar tarefa via formulario adiciona o item a lista', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Nova tarefa', data: '2026-08-06', concluida: false }])
    vi.mocked(tarefasApi.criarTarefa).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Nova tarefa',
      data: '2026-08-06',
      concluida: false,
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Tarefa'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Nova tarefa')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-06')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Nova tarefa/)).toBeInTheDocument()
  })

  it('editar uma tarefa existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Descricao antiga', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Descricao nova', data: '2026-08-05', concluida: false }])
    vi.mocked(tarefasApi.atualizarTarefa).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Descricao nova',
      data: '2026-08-05',
      concluida: false,
    })

    renderComProvider()
    await screen.findByText(/Descricao antiga/)
    await userEvent.click(screen.getByText('Editar'))

    expect(screen.getByLabelText('Descrição')).toHaveValue('Descricao antiga')

    await userEvent.clear(screen.getByLabelText('Descrição'))
    await userEvent.type(screen.getByLabelText('Descrição'), 'Descricao nova')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Descricao nova/)).toBeInTheDocument()
  })

  it('excluir tarefa remove o item da lista', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([])
    vi.mocked(tarefasApi.excluirTarefa).mockResolvedValue(undefined)

    renderComProvider()
    await screen.findByText(/Regar/)
    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(screen.queryByText(/Regar/)).not.toBeInTheDocument()
  })

  it('clicar no checkbox marca como concluida e a tarefa some da lista de pendentes', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: true }])
    vi.mocked(tarefasApi.alterarConclusao).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Regar',
      data: '2026-08-05',
      concluida: true,
    })

    renderComProvider()
    await screen.findByText(/Regar/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(vi.mocked(tarefasApi.alterarConclusao)).toHaveBeenCalledWith(1, true)
    expect(screen.queryByText(/Regar/)).not.toBeInTheDocument()
  })

  it('erro ao marcar conclusao aparece como mensagem inline', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false },
    ])
    vi.mocked(tarefasApi.alterarConclusao).mockRejectedValue(new ApiError(500, 'Erro interno do servidor.', {}))

    renderComProvider()
    await screen.findByText(/Regar/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })

  it('tarefa atrasada aparece com destaque visual', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Atrasada', data: '2026-08-01', concluida: false },
    ])

    renderComProvider()

    expect((await screen.findAllByText(/Atrasada/))[0].className).toContain('text-rust')
  })

  it('editar uma tarefa concluida nao afeta seu estado de conclusao', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Antiga', data: '2026-08-01', concluida: true },
    ])
    vi.mocked(tarefasApi.atualizarTarefa).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Nova',
      data: '2026-08-01',
      concluida: true,
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('Ver concluídas'))
    await screen.findByText(/Antiga/)
    await userEvent.click(screen.getByText('Editar'))
    await userEvent.clear(screen.getByLabelText('Descrição'))
    await userEvent.type(screen.getByLabelText('Descrição'), 'Nova')
    await userEvent.click(screen.getByText('Salvar'))

    expect(vi.mocked(tarefasApi.atualizarTarefa)).toHaveBeenCalledWith(
      1,
      expect.not.objectContaining({ concluida: expect.anything() }),
    )
  })
})
