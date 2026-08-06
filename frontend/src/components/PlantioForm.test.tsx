import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlantioForm } from './PlantioForm'
import type { Talhao } from '../api/talhoes'
import type { Cultura } from '../api/culturas'

const talhoes: Talhao[] = [{ id: 1, propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }]
const culturas: Cultura[] = [{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [], somente_leitura: false }]

describe('PlantioForm', () => {
  it('popula os selects de talhao e cultura a partir das props', () => {
    render(<PlantioForm talhoes={talhoes} culturas={culturas} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Talhao 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tomate' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores selecionados', async () => {
    const onSubmit = vi.fn()
    render(<PlantioForm talhoes={talhoes} culturas={culturas} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Talhao'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Cultura'), '1')
    await userEvent.type(screen.getByLabelText('Data do plantio'), '2026-08-02')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      talhao: 1,
      cultura: 1,
      data_plantio: '2026-08-02',
      status: 'em_andamento',
    })
  })

  it('mostra erro e nao chama onSubmit quando nenhum talhao e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<PlantioForm talhoes={talhoes} culturas={culturas} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Data do plantio'), '2026-08-02')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um talhao')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um plantio existente', () => {
    const plantio = { id: 5, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'colhido' as const }
    render(
      <PlantioForm talhoes={talhoes} culturas={culturas} plantio={plantio} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Data do plantio')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('Status')).toHaveValue('colhido')
  })
})
