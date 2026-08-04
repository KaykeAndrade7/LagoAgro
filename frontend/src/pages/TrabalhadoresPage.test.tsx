import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrabalhadoresPage } from './TrabalhadoresPage'
import * as trabalhadoresApi from '../api/trabalhadores'
import * as diariasApi from '../api/diarias'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/trabalhadores')
vi.mock('../api/diarias')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }
const trabalhador = { id: 1, nome: 'Joao', valor_diaria: '120.00', ativo: true }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TrabalhadoresPage />
    </QueryClientProvider>,
  )
}

describe('TrabalhadoresPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
  })

  it('lista carrega e renderiza os trabalhadores', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText(/Joao/)).toBeInTheDocument()
  })

  it('criar trabalhador via formulario adiciona o item a lista', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])
    vi.mocked(trabalhadoresApi.criarTrabalhador).mockResolvedValue(trabalhador)

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Trabalhador'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Joao/)).toBeInTheDocument()
  })

  it('expandir um trabalhador mostra suas diarias', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText(/Joao/))

    expect(await screen.findByText(/120.00/)).toBeInTheDocument()
  })

  it('diaria paga mostra "Paga" em vez de Editar/Excluir', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: 9 },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText(/Joao/))

    expect(await screen.findByText('Paga')).toBeInTheDocument()
  })

  it('excluir trabalhador com diarias mostra a contagem no dialogo', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null },
      { id: 2, trabalhador: 1, plantio: 1, data: '2026-08-06', valor: '120.00', lancamento: null },
    ])

    renderComProvider()
    await screen.findByText(/Joao/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(
      await screen.findByText('Este trabalhador tem 2 diaria(s) registrada(s) e nao podera ser excluido.'),
    ).toBeInTheDocument()
  })

  it('pagar diarias pendentes mostra a contagem e, ao confirmar, a mensagem de sucesso', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null },
    ])
    vi.mocked(trabalhadoresApi.pagarDiariasPendentes).mockResolvedValue([
      {
        id: 9,
        plantio: 1,
        valor: '120.00',
        data: '2026-08-05',
        descricao: 'Pagamento de diarias',
        setor: 'mao_de_obra',
      },
    ])

    renderComProvider()
    await screen.findByText(/Joao/)
    await userEvent.click(screen.getByText('Pagar diárias pendentes'))

    expect(await screen.findByText('Isso vai gerar 1 lancamento(s) de mao de obra.')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Confirmar'))

    expect(await screen.findByText('1 lançamento(s) de mão de obra criado(s).')).toBeInTheDocument()
  })

  it('pagar diarias sem pendencias mostra mensagem de nenhuma pendencia', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])

    renderComProvider()
    await screen.findByText(/Joao/)
    await userEvent.click(screen.getByText('Pagar diárias pendentes'))

    expect(await screen.findByText('Nenhuma diaria pendente para pagar.')).toBeInTheDocument()
  })
})
