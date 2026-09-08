import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FiltroPlantio } from './FiltroPlantio'

const opcoes = [
  { id: 1, label: 'Tomate — Talhao 1 — 01/07/2026' },
  { id: 2, label: 'Alface — Talhao 2 — 10/07/2026' },
]

describe('FiltroPlantio', () => {
  it('renderiza "Todos os plantios" e uma opcao por plantio', () => {
    render(<FiltroPlantio opcoes={opcoes} value={null} onChange={vi.fn()} />)
    const select = screen.getByLabelText('Filtrar por plantio')
    expect(select).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Todos os plantios' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 01/07/2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alface — Talhao 2 — 10/07/2026' })).toBeInTheDocument()
  })

  it('reflete o plantio selecionado via prop value', () => {
    render(<FiltroPlantio opcoes={opcoes} value={2} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Filtrar por plantio')).toHaveValue('2')
  })

  it('chama onChange com o id ao escolher um plantio', async () => {
    const onChange = vi.fn()
    render(<FiltroPlantio opcoes={opcoes} value={null} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por plantio'), '1')
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('chama onChange com null ao voltar para "Todos os plantios"', async () => {
    const onChange = vi.fn()
    render(<FiltroPlantio opcoes={opcoes} value={1} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por plantio'), 'Todos os plantios')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('nao renderiza nada quando nao ha plantios', () => {
    const { container } = render(<FiltroPlantio opcoes={[]} value={null} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
