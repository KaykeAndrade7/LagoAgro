import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PropriedadesPage } from './PropriedadesPage'
import * as propriedadesApi from '../api/propriedades'
import * as talhoesApi from '../api/talhoes'
import * as plantiosApi from '../api/plantios'

vi.mock('../api/propriedades')
vi.mock('../api/talhoes')
vi.mock('../api/plantios')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PropriedadesPage />
    </QueryClientProvider>,
  )
}

describe('PropriedadesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([])
  })

  it('lista carrega e renderiza as propriedades', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([{ id: 1, nome: 'Sitio Bela Vista' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText(/Sitio Bela Vista/)).toBeInTheDocument()
  })

  it('expandir uma propriedade mostra so os talhoes daquela propriedade', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([
      { id: 1, nome: 'Sitio A' },
      { id: 2, nome: 'Sitio B' },
    ])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 10, propriedade: 1, nome: 'Talhao A1', area: '1.00', tipo_solo: 'Arenoso' },
      { id: 20, propriedade: 2, nome: 'Talhao B1', area: '2.00', tipo_solo: 'Argiloso' },
    ])

    renderComProvider()
    await screen.findByText(/Sitio A/)

    await userEvent.click(screen.getByText(/Sitio A/))

    expect(screen.getByText(/Talhao A1/)).toBeInTheDocument()
    expect(screen.queryByText(/Talhao B1/)).not.toBeInTheDocument()
  })

  it('criar propriedade via formulario adiciona o item a lista', async () => {
    vi.mocked(propriedadesApi.listarPropriedades)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, nome: 'Nova propriedade' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([])
    vi.mocked(propriedadesApi.criarPropriedade).mockResolvedValue({ id: 1, nome: 'Nova propriedade' })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Propriedade'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Nova propriedade')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Nova propriedade/)).toBeInTheDocument()
  })

  it('excluir propriedade com talhoes mostra o aviso de cascata com a contagem certa', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([{ id: 1, nome: 'Sitio A' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 10, propriedade: 1, nome: 'Talhao A1', area: '1.00', tipo_solo: 'Arenoso' },
      { id: 11, propriedade: 1, nome: 'Talhao A2', area: '1.00', tipo_solo: 'Arenoso' },
    ])

    renderComProvider()
    await screen.findByText(/Sitio A/)

    await userEvent.click(screen.getAllByText('Excluir')[0])

    expect(
      await screen.findByText('Isso tambem excluira 2 talhao(oes) e todos os plantios registrados neles.'),
    ).toBeInTheDocument()
  })

  it('excluir talhao com plantios mostra o aviso de cascata com a contagem certa', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([{ id: 1, nome: 'Sitio A' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 10, propriedade: 1, nome: 'Talhao A1', area: '1.00', tipo_solo: 'Arenoso' },
    ])
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([
      { id: 100, talhao: 10, cultura: 1, data_plantio: '2026-01-01', status: 'em_andamento' },
    ])

    renderComProvider()
    await screen.findByText(/Sitio A/)
    await userEvent.click(screen.getByText(/Sitio A/))
    await screen.findByText(/Talhao A1/)

    await userEvent.click(screen.getAllByText('Excluir')[1])

    expect(
      await screen.findByText('Isso tambem excluira 1 plantio(s) registrado(s) neste talhao.'),
    ).toBeInTheDocument()
  })
})
