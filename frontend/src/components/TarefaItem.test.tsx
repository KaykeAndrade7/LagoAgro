import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TarefaItem } from './TarefaItem'

const tarefaPendente = { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }
const tarefaConcluida = { id: 2, plantio: 1, descricao: 'Adubar', data: '2026-08-01', concluida: true }

describe('TarefaItem', () => {
  it('renderiza descricao e data formatada', () => {
    render(<TarefaItem tarefa={tarefaPendente} atrasada={false} onToggleConcluida={vi.fn()} />)

    expect(screen.getByText(/Regar/)).toBeInTheDocument()
    expect(screen.getByText(/05\/08\/2026/)).toBeInTheDocument()
  })

  it('renderiza o rotulo quando fornecido', () => {
    render(
      <TarefaItem tarefa={tarefaPendente} rotulo="Tomate — Talhao 1" atrasada={false} onToggleConcluida={vi.fn()} />,
    )

    expect(screen.getByText(/Tomate — Talhao 1/)).toBeInTheDocument()
  })

  it('checkbox reflete tarefa.concluida', () => {
    render(<TarefaItem tarefa={tarefaConcluida} atrasada={false} onToggleConcluida={vi.fn()} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('clicar no checkbox chama onToggleConcluida com o valor invertido', async () => {
    const onToggleConcluida = vi.fn()
    render(<TarefaItem tarefa={tarefaPendente} atrasada={false} onToggleConcluida={onToggleConcluida} />)

    await userEvent.click(screen.getByRole('checkbox'))

    expect(onToggleConcluida).toHaveBeenCalledWith(true)
  })

  it('tarefa atrasada recebe classe de destaque', () => {
    render(<TarefaItem tarefa={tarefaPendente} atrasada={true} onToggleConcluida={vi.fn()} />)

    expect(screen.getByText(/Regar/).className).toContain('text-red-600')
  })

  it('tarefa concluida recebe estilo riscado, nao vermelho', () => {
    render(<TarefaItem tarefa={tarefaConcluida} atrasada={false} onToggleConcluida={vi.fn()} />)

    expect(screen.getByText(/Adubar/).className).toContain('line-through')
    expect(screen.getByText(/Adubar/).className).not.toContain('text-red-600')
  })
})
