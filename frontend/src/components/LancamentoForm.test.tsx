import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LancamentoForm } from './LancamentoForm'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

describe('LancamentoForm', () => {
  it('popula os selects de plantio, tipo e setor a partir das props', () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Gasto' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ganho' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mão de obra' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Insumos' })).toBeInTheDocument()
  })

  it('tipo Gasto e o padrao ao criar', () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Tipo')).toHaveValue('gasto')
  })

  it('trocar tipo pra ganho mostra as categorias de ganho e esconde as de gasto', async () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'ganho')

    expect(screen.getByRole('option', { name: 'Venda de colheita' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Insumos' })).not.toBeInTheDocument()
  })

  it('trocar de tipo com uma categoria que nao existe mais no novo tipo reseta pra uma valida', async () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Setor'), 'insumos')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'ganho')

    expect(screen.getByLabelText('Setor')).toHaveValue('venda_colheita')
  })

  it('chama onSubmit com os valores preenchidos', async () => {
    const onSubmit = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Valor'), '150.00')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.selectOptions(screen.getByLabelText('Setor'), 'insumos')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      plantio: 1,
      tipo: 'gasto',
      valor: '150.00',
      data: '2026-08-05',
      descricao: 'Compra de mudas',
      setor: 'insumos',
    })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Valor'), '150.00')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando valor nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Valor'), 'abc')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Valor deve ser um numero maior que zero')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um lancamento existente', () => {
    const lancamento = {
      id: 1,
      plantio: 1,
      tipo: 'ganho' as const,
      valor: '400.00',
      data: '2026-08-05',
      descricao: 'Venda de tomate',
      setor: 'venda_colheita' as const,
    }
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} lancamento={lancamento} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Tipo')).toHaveValue('ganho')
    expect(screen.getByLabelText('Valor')).toHaveValue('400.00')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Venda de tomate')
    expect(screen.getByLabelText('Setor')).toHaveValue('venda_colheita')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { descricao: ['Descricao muito longa.'] })
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Descricao muito longa.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
