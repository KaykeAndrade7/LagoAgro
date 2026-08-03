import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsumoForm } from './InsumoForm'
import { ApiError } from '../lib/api-client'

describe('InsumoForm', () => {
  it('chama onSubmit com os valores preenchidos, incluindo tipo e carencia_dias como numero', async () => {
    const onSubmit = vi.fn()
    render(<InsumoForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Calda bordalesa')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'adubo')
    await userEvent.clear(screen.getByLabelText('Carencia (dias)'))
    await userEvent.type(screen.getByLabelText('Carencia (dias)'), '5')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Calda bordalesa', tipo: 'adubo', carencia_dias: 5 })
  })

  it('mostra erro de validacao e nao chama onSubmit quando nome esta vazio', async () => {
    const onSubmit = vi.fn()
    render(<InsumoForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Nome e obrigatorio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando carencia_dias nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<InsumoForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Calda bordalesa')
    await userEvent.clear(screen.getByLabelText('Carencia (dias)'))
    await userEvent.type(screen.getByLabelText('Carencia (dias)'), 'abc')
    await userEvent.click(screen.getByText('Salvar'))

    expect(
      await screen.findByText('Carencia deve ser um numero inteiro maior ou igual a zero'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um insumo existente', () => {
    const insumo = { id: 1, nome: 'Insumo existente', tipo: 'adubo' as const, carencia_dias: 3 }
    render(<InsumoForm insumo={insumo} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Insumo existente')
    expect(screen.getByLabelText('Tipo')).toHaveValue('adubo')
    expect(screen.getByLabelText('Carencia (dias)')).toHaveValue('3')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<InsumoForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Ja existe um insumo com esse nome.'] })
    render(<InsumoForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Ja existe um insumo com esse nome.')).toBeInTheDocument()
  })

  it('mapeia erro de campo tipo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { tipo: ['Tipo invalido.'] })
    render(<InsumoForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Tipo invalido.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<InsumoForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
