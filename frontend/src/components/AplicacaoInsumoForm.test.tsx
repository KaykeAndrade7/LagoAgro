import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AplicacaoInsumoForm } from './AplicacaoInsumoForm'
import type { Insumo } from '../api/insumos'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]
const insumos: Insumo[] = [{ id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 }]

describe('AplicacaoInsumoForm', () => {
  it('popula os selects de plantio e insumo a partir das props', () => {
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Calda bordalesa' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores selecionados', async () => {
    const onSubmit = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), '2.5')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.5' })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), '2.5')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando quantidade nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), 'abc')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Quantidade deve ser um numero maior que zero')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={vi.fn()} onCancel={onCancel} />,
    )

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { quantidade: ['Quantidade invalida.'] })
    render(
      <AplicacaoInsumoForm
        plantioOpcoes={plantioOpcoes}
        insumos={insumos}
        erro={erro}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(await screen.findByText('Quantidade invalida.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(
      <AplicacaoInsumoForm
        plantioOpcoes={plantioOpcoes}
        insumos={insumos}
        erro={erro}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
