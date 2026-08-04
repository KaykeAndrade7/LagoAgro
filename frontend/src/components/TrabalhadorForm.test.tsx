import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrabalhadorForm } from './TrabalhadorForm'
import { ApiError } from '../lib/api-client'

describe('TrabalhadorForm', () => {
  it('chama onSubmit com os valores preenchidos, ativo comecando marcado', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Joao', valor_diaria: '120.00', ativo: true })
  })

  it('desmarcar ativo manda ativo: false', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByLabelText('Ativo'))
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Joao', valor_diaria: '120.00', ativo: false })
  })

  it('mostra erro de validacao e nao chama onSubmit quando nome esta vazio', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Nome e obrigatorio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando valor da diaria nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), 'abc')
    await userEvent.click(screen.getByText('Salvar'))

    expect(
      await screen.findByText('Valor da diaria deve ser um numero maior que zero'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um trabalhador existente', () => {
    const trabalhador = { id: 1, nome: 'Joao', valor_diaria: '120.00', ativo: false }
    render(<TrabalhadorForm trabalhador={trabalhador} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Joao')
    expect(screen.getByLabelText('Valor da diária')).toHaveValue('120.00')
    expect(screen.getByLabelText('Ativo')).not.toBeChecked()
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<TrabalhadorForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Ja existe um trabalhador com esse nome.'] })
    render(<TrabalhadorForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Ja existe um trabalhador com esse nome.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<TrabalhadorForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
