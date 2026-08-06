import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CulturaForm } from './CulturaForm'
import { ApiError } from '../lib/api-client'

describe('CulturaForm', () => {
  it('chama onSubmit com nome, ciclo_dias e a fase padrao preenchidos como numero', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '0')
    await userEvent.type(screen.getByLabelText('Dia fim'), '20')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
    })
  })

  it('adicionar fase inclui uma segunda linha no payload', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '0')
    await userEvent.type(screen.getByLabelText('Dia fim'), '20')
    await userEvent.click(screen.getByText('Adicionar fase'))

    const nomesFase = screen.getAllByLabelText('Fase')
    const diasInicio = screen.getAllByLabelText('Dia início')
    const diasFim = screen.getAllByLabelText('Dia fim')
    await userEvent.type(nomesFase[1], 'Colheita')
    await userEvent.type(diasInicio[1], '20')
    await userEvent.type(diasFim[1], '70')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [
        { nome: 'Muda', dia_inicio: 0, dia_fim: 20 },
        { nome: 'Colheita', dia_inicio: 20, dia_fim: 70 },
      ],
    })
  })

  it('remover a unica fase e tentar salvar mostra erro e nao chama onSubmit', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByText('Remover'))
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Cadastre pelo menos uma fase')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando dia_inicio nao e menor que dia_fim numa fase', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '20')
    await userEvent.type(screen.getByLabelText('Dia fim'), '10')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('dia_inicio deve ser menor que dia_fim')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula nome, ciclo_dias e a lista de fases ao editar', () => {
    const cultura = {
      id: 1,
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [
        { id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 },
        { id: 2, nome: 'Colheita', dia_inicio: 20, dia_fim: 70 },
      ],
      somente_leitura: false,
    }
    render(<CulturaForm cultura={cultura} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Tomate Cereja')
    expect(screen.getByLabelText('Ciclo (dias)')).toHaveValue('70')
    const nomesFase = screen.getAllByLabelText('Fase')
    expect(nomesFase).toHaveLength(2)
    expect(nomesFase[0]).toHaveValue('Muda')
    expect(nomesFase[1]).toHaveValue('Colheita')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<CulturaForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo nome do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Já existe uma cultura com esse nome.'] })
    render(<CulturaForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Já existe uma cultura com esse nome.')).toBeInTheDocument()
  })

  it('mapeia erro de campo fases do backend para a mensagem de fases', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { fases: ['Fase incompleta, faltando: dia_fim.'] })
    render(<CulturaForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Fase incompleta, faltando: dia_fim.')).toBeInTheDocument()
  })
})
