import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinanceiroPage } from './FinanceiroPage'
import * as lancamentosApi from '../api/lancamentos'
import * as diariasApi from '../api/diarias'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/lancamentos')
vi.mock('../api/diarias')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <FinanceiroPage />
    </QueryClientProvider>,
  )
}

describe('FinanceiroPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])
  })

  it('lista carrega e mostra o total geral', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      { id: 2, plantio: 1, valor: '50.00', data: '2026-08-06', descricao: 'Frete', setor: 'transporte' },
    ])

    renderComProvider()

    expect(await screen.findByText(/Compra de mudas/)).toBeInTheDocument()
    expect(await screen.findByText('Total: R$ 200.00')).toBeInTheDocument()
  })

  it('criar lancamento via formulario adiciona o item a lista', async () => {
    vi.mocked(lancamentosApi.listarLancamentos)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, plantio: 1, valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      ])
    vi.mocked(lancamentosApi.criarLancamento).mockResolvedValue({
      id: 1,
      plantio: 1,
      valor: '150.00',
      data: '2026-08-05',
      descricao: 'Compra de mudas',
      setor: 'insumos',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Lançamento'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Valor'), '150.00')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Compra de mudas/)).toBeInTheDocument()
  })

  it('excluir lancamento sem diarias vinculadas nao mostra aviso de uso', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
    ])

    renderComProvider()
    await screen.findByText(/Compra de mudas/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(await screen.findByText('Tem certeza que deseja excluir este lancamento?')).toBeInTheDocument()
  })

  it('excluir lancamento com diarias vinculadas mostra a contagem no dialogo', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, valor: '120.00', data: '2026-08-05', descricao: 'Pagamento de diarias', setor: 'mao_de_obra' },
    ])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-01', valor: '120.00', lancamento: 1 },
    ])

    renderComProvider()
    await screen.findByText(/Pagamento de diarias/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(
      await screen.findByText('Este lancamento paga 1 diaria(s) e nao podera ser excluido.'),
    ).toBeInTheDocument()
  })
})
