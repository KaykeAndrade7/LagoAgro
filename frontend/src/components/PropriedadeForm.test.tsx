import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PropriedadeForm } from './PropriedadeForm'

describe('PropriedadeForm', () => {
  it('chama onSubmit com o nome preenchido', async () => {
    const onSubmit = vi.fn()
    render(<PropriedadeForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Sitio Bela Vista')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Sitio Bela Vista' })
  })

  it('mostra erro de validacao e nao chama onSubmit quando nome esta vazio', async () => {
    const onSubmit = vi.fn()
    render(<PropriedadeForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Nome e obrigatorio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula o campo nome quando editando uma propriedade existente', () => {
    render(
      <PropriedadeForm propriedade={{ id: 1, nome: 'Sitio Existente' }} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Nome')).toHaveValue('Sitio Existente')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<PropriedadeForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
