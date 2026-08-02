import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CulturasPage } from './CulturasPage'
import * as culturasApi from '../api/culturas'

vi.mock('../api/culturas')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CulturasPage />
    </QueryClientProvider>,
  )
}

describe('CulturasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lista carrega e mostra nome e ciclo de cada cultura', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }])

    renderComProvider()

    expect(await screen.findByText(/Tomate.*90 dias/)).toBeInTheDocument()
  })

  it('expandir uma cultura mostra suas fases na ordem certa', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([
      {
        id: 1,
        nome: 'Tomate',
        ciclo_dias: 90,
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

  it('nao mostra nenhum elemento de criar, editar ou excluir', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }])

    renderComProvider()
    await screen.findByText(/Tomate/)

    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Excluir')).not.toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
  })
})
