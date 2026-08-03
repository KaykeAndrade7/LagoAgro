import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InsumosPage } from './InsumosPage'
import * as insumosApi from '../api/insumos'
import * as aplicacoesApi from '../api/aplicacoes'
import { ApiError } from '../lib/api-client'

vi.mock('../api/insumos')
vi.mock('../api/aplicacoes')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <InsumosPage />
    </QueryClientProvider>,
  )
}

describe('InsumosPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([])
  })

  it('lista carrega e renderiza os insumos', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])

    renderComProvider()

    expect(await screen.findByText(/Calda bordalesa/)).toBeInTheDocument()
  })

  it('criar insumo via formulario adiciona o item a lista', async () => {
    vi.mocked(insumosApi.listarInsumos)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, nome: 'Novo insumo', tipo: 'adubo', carencia_dias: 0 }])
    vi.mocked(insumosApi.criarInsumo).mockResolvedValue({ id: 1, nome: 'Novo insumo', tipo: 'adubo', carencia_dias: 0 })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Insumo'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Novo insumo')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Novo insumo/)).toBeInTheDocument()
  })

  it('excluir insumo sem aplicacoes vinculadas nao mostra aviso de uso', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    await userEvent.click(screen.getByText('Excluir'))

    expect(await screen.findByText('Tem certeza que deseja excluir este insumo?')).toBeInTheDocument()
  })

  it('excluir insumo com N aplicacoes mostra a contagem certa no dialogo', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([
      { id: 100, plantio: 1, insumo: 1, data: '2026-01-01', quantidade: '1.00' },
      { id: 101, plantio: 2, insumo: 1, data: '2026-01-02', quantidade: '2.00' },
    ])

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    await userEvent.click(screen.getByText('Excluir'))

    expect(
      await screen.findByText('Este insumo e usado em 2 aplicacao(oes) registrada(s) e nao podera ser excluido.'),
    ).toBeInTheDocument()
  })

  it('erro 409 simulado do backend aparece como mensagem no dialogo sem fecha-lo', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])
    vi.mocked(insumosApi.excluirInsumo).mockRejectedValue(
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

  it('editar um insumo existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    vi.mocked(insumosApi.listarInsumos)
      .mockResolvedValueOnce([{ id: 1, nome: 'Nome antigo', tipo: 'veneno', carencia_dias: 7 }])
      .mockResolvedValueOnce([{ id: 1, nome: 'Nome atualizado', tipo: 'veneno', carencia_dias: 7 }])
    vi.mocked(insumosApi.atualizarInsumo).mockResolvedValue({
      id: 1,
      nome: 'Nome atualizado',
      tipo: 'veneno',
      carencia_dias: 7,
    })

    renderComProvider()
    await screen.findByText(/Nome antigo/)
    await userEvent.click(screen.getByText('Editar'))

    expect(screen.getByLabelText('Nome')).toHaveValue('Nome antigo')

    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Nome atualizado')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Nome atualizado/)).toBeInTheDocument()
  })
})
