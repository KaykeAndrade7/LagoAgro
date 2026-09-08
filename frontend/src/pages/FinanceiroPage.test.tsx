import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinanceiroPage } from './FinanceiroPage'
import { ApiError } from '../lib/api-client'
import * as lancamentosApi from '../api/lancamentos'
import * as diariasApi from '../api/diarias'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/lancamentos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/lancamentos')>()
  return {
    ...actual,
    listarLancamentos: vi.fn(),
    criarLancamento: vi.fn(),
    atualizarLancamento: vi.fn(),
    excluirLancamento: vi.fn(),
  }
})
vi.mock('../api/diarias')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const plantio2 = { id: 2, talhao: 2, cultura: 1, data_plantio: '2026-07-10', status: 'em_andamento' as const }
const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }
const talhao2 = { id: 2, propriedade: 1, nome: 'Talhao 2', area: '1.00', tipo_solo: 'arenoso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [], somente_leitura: false }

function renderComProvider(rota = '/financeiro') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <QueryClientProvider client={queryClient}>
        <FinanceiroPage />
      </QueryClientProvider>
    </MemoryRouter>,
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

  it('lista carrega e mostra os totais separados de gasto, ganho e saldo', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      { id: 2, plantio: 1, tipo: 'gasto', valor: '30.00', data: '2026-08-06', descricao: 'Frete', setor: 'transporte' },
      { id: 3, plantio: 1, tipo: 'ganho', valor: '400.00', data: '2026-08-07', descricao: 'Venda tomate', setor: 'venda_colheita' },
    ])

    renderComProvider()

    expect(await screen.findByText(/Compra de mudas/)).toBeInTheDocument()
    expect(await screen.findByText('R$ 180.00')).toBeInTheDocument()
    expect(await screen.findByText('R$ 400.00')).toBeInTheDocument()
    expect(await screen.findByText('R$ 220.00')).toBeInTheDocument()
  })

  it('filtro mostra so os gastos, so os ganhos, ou todos', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      { id: 2, plantio: 1, tipo: 'ganho', valor: '400.00', data: '2026-08-07', descricao: 'Venda tomate', setor: 'venda_colheita' },
    ])

    renderComProvider()
    await screen.findByText(/Compra de mudas/)
    expect(screen.getByText(/Venda tomate/)).toBeInTheDocument()

    // Os totais (gasto 150, ganho 400, saldo 250) nunca devem mudar com o
    // filtro - so a lista de lancamentos visiveis muda.
    expect(screen.getByText('R$ 150.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 400.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 250.00')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Gastos'))
    expect(screen.getByText(/Compra de mudas/)).toBeInTheDocument()
    expect(screen.queryByText(/Venda tomate/)).not.toBeInTheDocument()
    expect(screen.getByText('R$ 150.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 400.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 250.00')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Ganhos'))
    expect(screen.queryByText(/Compra de mudas/)).not.toBeInTheDocument()
    expect(screen.getByText(/Venda tomate/)).toBeInTheDocument()
    expect(screen.getByText('R$ 150.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 400.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 250.00')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Todos'))
    expect(screen.getByText(/Compra de mudas/)).toBeInTheDocument()
    expect(screen.getByText(/Venda tomate/)).toBeInTheDocument()
    expect(screen.getByText('R$ 150.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 400.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 250.00')).toBeInTheDocument()
  })

  it('filtra lancamentos e recalcula os totais pelo plantio escolhido', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio, plantio2])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao, talhao2])
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '100.00', data: '2026-08-05', descricao: 'Mudas P1', setor: 'insumos' },
      { id: 2, plantio: 1, tipo: 'ganho', valor: '300.00', data: '2026-08-07', descricao: 'Venda P1', setor: 'venda_colheita' },
      { id: 3, plantio: 2, tipo: 'gasto', valor: '40.00', data: '2026-08-06', descricao: 'Frete P2', setor: 'transporte' },
      { id: 4, plantio: 2, tipo: 'ganho', valor: '25.00', data: '2026-08-08', descricao: 'Venda P2', setor: 'venda_colheita' },
    ])

    renderComProvider()

    await screen.findByText(/Mudas P1/)
    expect(screen.getByText('R$ 140.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 325.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 185.00')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por plantio'), '1')

    expect(screen.getByText(/Mudas P1/)).toBeInTheDocument()
    expect(screen.queryByText(/Frete P2/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Venda P2/)).not.toBeInTheDocument()
    expect(screen.getByText('R$ 100.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 300.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 200.00')).toBeInTheDocument()
    expect(screen.queryByText('R$ 140.00')).not.toBeInTheDocument()
  })

  it('o filtro de plantio combina com o toggle Gastos/Ganhos sem mexer nos totais', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio, plantio2])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao, talhao2])
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '100.00', data: '2026-08-05', descricao: 'Mudas P1', setor: 'insumos' },
      { id: 2, plantio: 1, tipo: 'ganho', valor: '300.00', data: '2026-08-07', descricao: 'Venda P1', setor: 'venda_colheita' },
      { id: 3, plantio: 2, tipo: 'gasto', valor: '40.00', data: '2026-08-06', descricao: 'Frete P2', setor: 'transporte' },
    ])

    renderComProvider()
    await screen.findByText(/Mudas P1/)

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por plantio'), '1')
    await userEvent.click(screen.getByText('Gastos'))

    expect(screen.getByText(/Mudas P1/)).toBeInTheDocument()
    expect(screen.queryByText(/Venda P1/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Frete P2/)).not.toBeInTheDocument()
    expect(screen.getByText('R$ 100.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 300.00')).toBeInTheDocument()
    expect(screen.getByText('R$ 200.00')).toBeInTheDocument()
  })

  it('aplica o filtro de plantio vindo da URL (?plantio=2)', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio, plantio2])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao, talhao2])
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '100.00', data: '2026-08-05', descricao: 'Mudas P1', setor: 'insumos' },
      { id: 3, plantio: 2, tipo: 'gasto', valor: '40.00', data: '2026-08-06', descricao: 'Frete P2', setor: 'transporte' },
    ])

    renderComProvider('/financeiro?plantio=2')

    await screen.findByText(/Frete P2/)
    expect(screen.queryByText(/Mudas P1/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Filtrar por plantio')).toHaveValue('2')
    expect(screen.getByText('R$ 40.00')).toBeInTheDocument()
  })

  it('criar lancamento limpa o filtro de plantio pra revelar o novo registro', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio, plantio2])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao, talhao2])
    vi.mocked(lancamentosApi.listarLancamentos)
      .mockResolvedValueOnce([
        { id: 3, plantio: 2, tipo: 'gasto', valor: '40.00', data: '2026-08-06', descricao: 'Frete P2', setor: 'transporte' },
      ])
      .mockResolvedValue([
        { id: 3, plantio: 2, tipo: 'gasto', valor: '40.00', data: '2026-08-06', descricao: 'Frete P2', setor: 'transporte' },
        { id: 4, plantio: 1, tipo: 'gasto', valor: '10.00', data: '2026-08-09', descricao: 'Semente P1', setor: 'insumos' },
      ])
    vi.mocked(lancamentosApi.criarLancamento).mockResolvedValue({
      id: 4,
      plantio: 1,
      tipo: 'gasto',
      valor: '10.00',
      data: '2026-08-09',
      descricao: 'Semente P1',
      setor: 'insumos',
    })

    renderComProvider('/financeiro?plantio=2')
    await screen.findByText(/Frete P2/)
    expect(screen.queryByText(/Semente P1/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('+ Lançamento'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Valor'), '10.00')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-09')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Semente P1')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Semente P1/)).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrar por plantio')).toHaveValue('')
  })

  it('criar lancamento via formulario adiciona o item a lista', async () => {
    vi.mocked(lancamentosApi.listarLancamentos)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      ])
    vi.mocked(lancamentosApi.criarLancamento).mockResolvedValue({
      id: 1,
      plantio: 1,
      tipo: 'gasto',
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
      { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
    ])

    renderComProvider()
    await screen.findByText(/Compra de mudas/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(await screen.findByText('Tem certeza que deseja excluir este lancamento?')).toBeInTheDocument()
  })

  it('excluir lancamento com diarias vinculadas avisa que o pagamento sera desfeito', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '120.00', data: '2026-08-05', descricao: 'Pagamento de diarias', setor: 'mao_de_obra' },
    ])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-01', valor: '120.00', lancamento: 1 },
    ])

    renderComProvider()
    await screen.findByText(/Pagamento de diarias/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(
      await screen.findByText(
        'Este lancamento paga 1 diaria(s). Excluir vai desfazer o pagamento delas (voltam a ficar pendentes).',
      ),
    ).toBeInTheDocument()
  })

  it('erro 409 simulado do backend aparece como mensagem no dialogo sem fecha-lo', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
    ])
    vi.mocked(lancamentosApi.excluirLancamento).mockRejectedValue(
      new ApiError(409, 'Nao e possivel excluir: existem registros vinculados a este item.', {
        detail: 'Nao e possivel excluir: existem registros vinculados a este item.',
      }),
    )

    renderComProvider()
    await screen.findByText(/Compra de mudas/)
    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(
      await screen.findByText('Nao e possivel excluir: existem registros vinculados a este item.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
