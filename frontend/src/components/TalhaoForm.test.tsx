import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TalhaoForm } from './TalhaoForm'

describe('TalhaoForm', () => {
  it('chama onSubmit com os valores preenchidos, incluindo propriedadeId', async () => {
    const onSubmit = vi.fn()
    render(<TalhaoForm propriedadeId={7} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Talhao Norte')
    await userEvent.type(screen.getByLabelText('Area (hectares)'), '3.5')
    await userEvent.type(screen.getByLabelText('Tipo de solo'), 'Argiloso')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      propriedade: 7,
      nome: 'Talhao Norte',
      area: '3.5',
      tipo_solo: 'Argiloso',
    })
  })

  it('mostra erro quando area nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<TalhaoForm propriedadeId={7} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Talhao Norte')
    await userEvent.type(screen.getByLabelText('Area (hectares)'), 'abc')
    await userEvent.type(screen.getByLabelText('Tipo de solo'), 'Argiloso')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Area deve ser um numero maior que zero')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um talhao existente', () => {
    const talhao = { id: 1, propriedade: 7, nome: 'Talhao Existente', area: '2.00', tipo_solo: 'Arenoso' }
    render(<TalhaoForm propriedadeId={7} talhao={talhao} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Talhao Existente')
    expect(screen.getByLabelText('Area (hectares)')).toHaveValue('2.00')
    expect(screen.getByLabelText('Tipo de solo')).toHaveValue('Arenoso')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<TalhaoForm propriedadeId={7} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
