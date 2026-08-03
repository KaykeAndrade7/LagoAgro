import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ColheitaForm } from './ColheitaForm'
import * as plantiosApi from '../api/plantios'
import { ApiError } from '../lib/api-client'

vi.mock('../api/plantios')

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

function renderComProvider(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ColheitaForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.obterDataSeguraColheita).mockResolvedValue({ data_segura: null })
  })

  it('popula o select de plantio a partir das props', () => {
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores preenchidos', async () => {
    const onSubmit = vi.fn()
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.selectOptions(screen.getByLabelText('Classificação'), 'segunda')
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '10')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      plantio: 1,
      data: '2026-08-05',
      classificacao: 'segunda',
      quantidade: '10',
    })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '10')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('busca e exibe a data segura ao selecionar um plantio', async () => {
    vi.mocked(plantiosApi.obterDataSeguraColheita).mockResolvedValue({ data_segura: '2026-08-10' })
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')

    expect(await screen.findByText('Data segura para colher: 10/08/2026')).toBeInTheDocument()
  })

  it('mostra mensagem de sem restricao quando a data segura vem nula', async () => {
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')

    expect(
      await screen.findByText('Nenhuma restrição de carência para este plantio.'),
    ).toBeInTheDocument()
  })

  it('pre-popula os campos quando editando uma colheita existente', () => {
    const colheita = { id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira' as const, quantidade: '5.00' }
    renderComProvider(
      <ColheitaForm plantioOpcoes={plantioOpcoes} colheita={colheita} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
    expect(screen.getByLabelText('Quantidade (caixas)')).toHaveValue('5.00')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { quantidade: ['Quantidade invalida.'] })
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Quantidade invalida.')).toBeInTheDocument()
  })
})
