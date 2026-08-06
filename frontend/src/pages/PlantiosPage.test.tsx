import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlantiosPage } from './PlantiosPage'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlantiosPage />
    </QueryClientProvider>,
  )
}

describe('PlantiosPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'Arenoso' },
    ])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [], somente_leitura: false }])
  })

  it('selects do formulario sao populados a partir das queries de talhoes e culturas', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([])

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Plantio'))

    expect(screen.getByRole('option', { name: 'Talhao 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tomate' })).toBeInTheDocument()
  })

  it('criar plantio faz o novo item aparecer na lista com os rotulos certos', async () => {
    vi.mocked(plantiosApi.listarPlantios)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' }])
    vi.mocked(plantiosApi.criarPlantio).mockResolvedValue({
      id: 1,
      talhao: 1,
      cultura: 1,
      data_plantio: '2026-08-02',
      status: 'em_andamento',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Plantio'))
    await userEvent.selectOptions(screen.getByLabelText('Talhao'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Cultura'), '1')
    await userEvent.type(screen.getByLabelText('Data do plantio'), '2026-08-02')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Tomate.*Talhao 1/)).toBeInTheDocument()
    expect(screen.getByText(/Em andamento/)).toBeInTheDocument()
  })

  it('editar um plantio existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    const plantioOriginal = {
      id: 1,
      talhao: 1,
      cultura: 1,
      data_plantio: '2026-08-02',
      status: 'em_andamento' as const,
    }
    vi.mocked(plantiosApi.listarPlantios)
      .mockResolvedValueOnce([plantioOriginal])
      .mockResolvedValueOnce([{ ...plantioOriginal, status: 'colhido' }])
    vi.mocked(plantiosApi.atualizarPlantio).mockResolvedValue({ ...plantioOriginal, status: 'colhido' })

    renderComProvider()
    await userEvent.click(await screen.findByText('Editar'))

    expect(screen.getByLabelText('Status')).toHaveValue('em_andamento')

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'colhido')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Colhido/)).toBeInTheDocument()
  })

  it('excluir plantio pede confirmacao antes de excluir', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([
      { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText('Excluir'))

    expect(screen.getByText('Tem certeza que deseja excluir este plantio?')).toBeInTheDocument()
    expect(plantiosApi.excluirPlantio).not.toHaveBeenCalled()
  })
})
