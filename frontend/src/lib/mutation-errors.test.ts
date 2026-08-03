import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMapeamentoErroFormulario } from './mutation-errors'
import { ApiError } from './api-client'

type FormularioTeste = { nome: string; idade: number }

describe('useMapeamentoErroFormulario', () => {
  it('mapeia erro de campo conhecido para setError', () => {
    const setError = vi.fn()
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Nome invalido.'] })

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('nome', { message: 'Nome invalido.' })
    expect(setError).not.toHaveBeenCalledWith('root', expect.anything())
  })

  it('mapeia mais de um campo conhecido quando o backend devolve os dois', () => {
    const setError = vi.fn()
    const erro = new ApiError(400, 'Erro de validacao', {
      nome: ['Nome invalido.'],
      idade: ['Idade invalida.'],
    })

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('nome', { message: 'Nome invalido.' })
    expect(setError).toHaveBeenCalledWith('idade', { message: 'Idade invalida.' })
  })

  it('cai no root quando nenhum campo conhecido bate', () => {
    const setError = vi.fn()
    const erro = new ApiError(500, 'Erro interno do servidor.', {})

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('root', { message: 'Erro interno do servidor.' })
  })

  it('usa o detail do corpo quando presente, mesmo sem campo conhecido', () => {
    const setError = vi.fn()
    const erro = new ApiError(409, 'Erro', { detail: 'Conflito de dados.' })

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('root', { message: 'Conflito de dados.' })
  })

  it('nao chama setError quando erro e null', () => {
    const setError = vi.fn()

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(null, setError, ['nome', 'idade']))

    expect(setError).not.toHaveBeenCalled()
  })

  it('nao chama setError quando erro e undefined', () => {
    const setError = vi.fn()

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(undefined, setError, ['nome', 'idade']))

    expect(setError).not.toHaveBeenCalled()
  })
})
