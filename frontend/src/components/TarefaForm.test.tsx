import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TarefaForm } from './TarefaForm'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

describe('TarefaForm', () => {
  it('popula o select de plantio a partir das props', () => {
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores preenchidos', async () => {
    const onSubmit = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Regar')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ plantio: 1, descricao: 'Regar', data: '2026-08-05' })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Descrição'), 'Regar')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando descricao esta vazia', async () => {
    const onSubmit = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Descricao e obrigatoria')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando uma tarefa existente', () => {
    const tarefa = { id: 1, plantio: 1, descricao: 'Tarefa existente', data: '2026-08-05', concluida: false }
    render(<TarefaForm plantioOpcoes={plantioOpcoes} tarefa={tarefa} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Tarefa existente')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { descricao: ['Descricao muito longa.'] })
    render(<TarefaForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Descricao muito longa.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<TarefaForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
