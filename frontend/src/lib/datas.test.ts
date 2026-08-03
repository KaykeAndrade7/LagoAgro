import { describe, it, expect } from 'vitest'
import { estaAtrasada } from './datas'

describe('estaAtrasada', () => {
  it('retorna true para tarefa nao concluida com data passada', () => {
    expect(estaAtrasada({ data: '2026-08-01', concluida: false }, '2026-08-05')).toBe(true)
  })

  it('retorna false para tarefa nao concluida com data de hoje', () => {
    expect(estaAtrasada({ data: '2026-08-05', concluida: false }, '2026-08-05')).toBe(false)
  })

  it('retorna false para tarefa nao concluida com data futura', () => {
    expect(estaAtrasada({ data: '2026-08-10', concluida: false }, '2026-08-05')).toBe(false)
  })

  it('retorna false para tarefa concluida com data passada', () => {
    expect(estaAtrasada({ data: '2026-08-01', concluida: true }, '2026-08-05')).toBe(false)
  })
})
