import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AplicacoesPage } from './AplicacoesPage'
import * as aplicacoesApi from '../api/aplicacoes'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'
import * as insumosApi from '../api/insumos'
import { ApiError } from '../lib/api-client'

vi.mock('../api/aplicacoes')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')
vi.mock('../api/insumos')

const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [], somente_leitura: false }
const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' as const }
const insumo = { id: 1, nome: 'Calda bordalesa', tipo: 'veneno' as const, carencia_dias: 7 }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AplicacoesPage />
    </QueryClientProvider>,
  )
}

describe('AplicacoesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([insumo])
  })

  it('selects de plantio e insumo sao populados com os labels reconstruidos certos', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([])

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Aplicação'))

    expect(screen.getByRole('option', { name: /Tomate — Talhao 1 — 02\/08\/2026/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Calda bordalesa' })).toBeInTheDocument()
  })

  it('criar aplicacao via formulario adiciona o item a lista com os labels certos', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }])
    vi.mocked(aplicacoesApi.criarAplicacao).mockResolvedValue({
      id: 1,
      plantio: 1,
      insumo: 1,
      data: '2026-08-02',
      quantidade: '2.50',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Aplicação'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), '2.50')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Calda bordalesa/)).toBeInTheDocument()
    expect(screen.getByText(/Tomate — Talhao 1/)).toBeInTheDocument()
  })

  it('nenhum botao Editar esta presente na pagina', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([
      { id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' },
    ])

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
  })

  it('excluir aplicacao remove o item da lista', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }])
      .mockResolvedValueOnce([])
    vi.mocked(aplicacoesApi.excluirAplicacao).mockResolvedValue(undefined)

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(screen.queryByText(/Calda bordalesa/)).not.toBeInTheDocument()
  })

  it('erro 409 simulado do backend aparece como mensagem no dialogo sem fecha-lo', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([
      { id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' },
    ])
    vi.mocked(aplicacoesApi.excluirAplicacao).mockRejectedValue(
      new ApiError(409, 'Nao e possivel excluir: existem registros vinculados a este item.', {
        detail: 'Nao e possivel excluir: existem registros vinculados a este item.',
      }),
    )

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)
    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(
      await screen.findByText('Nao e possivel excluir: existem registros vinculados a este item.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
