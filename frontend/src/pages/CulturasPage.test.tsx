import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CulturasPage } from './CulturasPage'
import * as culturasApi from '../api/culturas'
import { ApiError } from '../lib/api-client'

vi.mock('../api/culturas')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CulturasPage />
    </QueryClientProvider>,
  )
}

const embutida = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [], somente_leitura: true }
const propria = {
  id: 2,
  nome: 'Tomate Cereja',
  ciclo_dias: 70,
  fases: [{ id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
  somente_leitura: false,
}

describe('CulturasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lista carrega e mostra nome e ciclo de cada cultura', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([embutida])

    renderComProvider()

    expect(await screen.findByText(/Tomate.*90 dias/)).toBeInTheDocument()
  })

  it('expandir uma cultura mostra suas fases na ordem certa', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([
      {
        ...embutida,
        fases: [
          { id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 },
          { id: 2, nome: 'Floracao', dia_inicio: 21, dia_fim: 50 },
        ],
      },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText(/Tomate/))

    const fases = screen.getAllByText(/dia \d+ a \d+/)
    expect(fases[0]).toHaveTextContent('Muda')
    expect(fases[1]).toHaveTextContent('Floracao')
  })

  it('cultura embutida nao mostra editar ou excluir', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([embutida])

    renderComProvider()
    await screen.findByText(/Tomate/)

    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Excluir')).not.toBeInTheDocument()
  })

  it('cultura propria mostra editar e excluir', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])

    renderComProvider()
    await screen.findByText(/Tomate Cereja/)

    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeInTheDocument()
  })

  it('criar uma cultura nova chama criarCultura e atualiza a lista', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([])
    vi.mocked(culturasApi.criarCultura).mockResolvedValue(propria)

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Cultura'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '0')
    await userEvent.type(screen.getByLabelText('Dia fim'), '20')
    await userEvent.click(screen.getByText('Salvar'))

    expect(culturasApi.criarCultura).toHaveBeenCalledWith({
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
    })
  })

  it('editar uma cultura propria pre-popula o formulario e chama atualizarCultura', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])
    vi.mocked(culturasApi.atualizarCultura).mockResolvedValue(propria)

    renderComProvider()
    await userEvent.click(await screen.findByText('Editar'))

    expect(screen.getByLabelText('Nome')).toHaveValue('Tomate Cereja')

    await userEvent.click(screen.getByText('Salvar'))

    expect(culturasApi.atualizarCultura).toHaveBeenCalledWith(2, expect.objectContaining({ nome: 'Tomate Cereja' }))
  })

  it('excluir uma cultura propria abre confirmacao e chama excluirCultura ao confirmar', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])
    vi.mocked(culturasApi.excluirCultura).mockResolvedValue(undefined)

    renderComProvider()
    await userEvent.click(await screen.findByText('Excluir'))
    await screen.findByText('Tem certeza que deseja excluir esta cultura?')
    await userEvent.click(screen.getByText('Confirmar'))

    expect(culturasApi.excluirCultura).toHaveBeenCalledWith(2)
  })

  it('erro ao excluir cultura em uso aparece no dialogo sem fecha-lo', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])
    vi.mocked(culturasApi.excluirCultura).mockRejectedValue(
      new ApiError(409, 'Não é possível excluir: existem registros vinculados a este item.'),
    )

    renderComProvider()
    await userEvent.click(await screen.findByText('Excluir'))
    await screen.findByText('Tem certeza que deseja excluir esta cultura?')
    await userEvent.click(screen.getByText('Confirmar'))

    expect(await screen.findByText('Não é possível excluir: existem registros vinculados a este item.')).toBeInTheDocument()
  })
})
