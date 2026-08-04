import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiariaForm } from './DiariaForm'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

describe('DiariaForm', () => {
  it('popula o select de plantio a partir das props', () => {
    render(<DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
  })

  it('chama onSubmit com o trabalhadorId fixo e os valores do formulario', async () => {
    const onSubmit = vi.fn()
    render(<DiariaForm trabalhadorId={7} plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ trabalhador: 7, plantio: 1, data: '2026-08-05' })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando uma diaria existente', () => {
    const diaria = { id: 1, trabalhador: 7, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null }
    render(
      <DiariaForm trabalhadorId={7} plantioOpcoes={plantioOpcoes} diaria={diaria} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { data: ['Ja existe uma diaria nesta data.'] })
    render(
      <DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(await screen.findByText('Ja existe uma diaria nesta data.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(400, 'Erro na requisicao', {
      non_field_errors: ['Não é possível alterar uma diária já paga.'],
    })
    render(
      <DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(await screen.findByText('Não é possível alterar uma diária já paga.')).toBeInTheDocument()
  })
})
