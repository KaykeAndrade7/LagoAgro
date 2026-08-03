import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ColheitasPage } from './ColheitasPage'
import * as colheitasApi from '../api/colheitas'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/colheitas')
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
      <ColheitasPage />
    </QueryClientProvider>,
  )
}

describe('ColheitasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
    vi.mocked(plantiosApi.obterDataSeguraColheita).mockResolvedValue({ data_segura: null })
  })

  it('lista carrega e renderiza as colheitas', async () => {
    vi.mocked(colheitasApi.listarColheitas).mockResolvedValue([
      { id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '10.00' },
    ])

    renderComProvider()

    expect(await screen.findByText(/Primeira/)).toBeInTheDocument()
  })

  it('criar colheita via formulario adiciona o item a lista', async () => {
    vi.mocked(colheitasApi.listarColheitas)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'segunda', quantidade: '3.00' }])
    vi.mocked(colheitasApi.criarColheita).mockResolvedValue({
      id: 1,
      plantio: 1,
      data: '2026-08-05',
      classificacao: 'segunda',
      quantidade: '3.00',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Colheita'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.selectOptions(screen.getByLabelText('Classificação'), 'segunda')
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '3')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Segunda/)).toBeInTheDocument()
  })

  it('editar uma colheita existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    vi.mocked(colheitasApi.listarColheitas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '10.00' }])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '20.00' }])
    vi.mocked(colheitasApi.atualizarColheita).mockResolvedValue({
      id: 1,
      plantio: 1,
      data: '2026-08-05',
      classificacao: 'primeira',
      quantidade: '20.00',
    })

    renderComProvider()
    await screen.findByText(/10\.00/)
    await userEvent.click(screen.getByText('Editar'))

    expect(screen.getByLabelText('Quantidade (caixas)')).toHaveValue('10.00')

    await userEvent.clear(screen.getByLabelText('Quantidade (caixas)'))
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '20.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/20\.00/)).toBeInTheDocument()
  })

  it('excluir colheita remove o item da lista', async () => {
    vi.mocked(colheitasApi.listarColheitas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '10.00' }])
      .mockResolvedValueOnce([])
    vi.mocked(colheitasApi.excluirColheita).mockResolvedValue(undefined)

    renderComProvider()
    await screen.findByText(/Primeira/)
    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(screen.queryByText(/Primeira/)).not.toBeInTheDocument()
  })
})
