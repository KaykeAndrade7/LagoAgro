import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { usePlantioFiltro } from './use-plantio-filtro'

const plantios = [{ id: 1 }, { id: 2 }, { id: 3 }]

function comRota(entrada: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[entrada]}>{children}</MemoryRouter>
}

describe('usePlantioFiltro', () => {
  it('retorna null quando nao ha parametro plantio na URL', () => {
    const { result } = renderHook(() => usePlantioFiltro(plantios), { wrapper: comRota('/tarefas') })
    expect(result.current.plantioId).toBeNull()
  })

  it('retorna o id numerico quando ?plantio= aponta para um plantio existente', () => {
    const { result } = renderHook(() => usePlantioFiltro(plantios), { wrapper: comRota('/tarefas?plantio=2') })
    expect(result.current.plantioId).toBe(2)
  })

  it('ignora ?plantio= que nao corresponde a nenhum plantio da lista', () => {
    const { result } = renderHook(() => usePlantioFiltro(plantios), { wrapper: comRota('/tarefas?plantio=999') })
    expect(result.current.plantioId).toBeNull()
  })

  it('ignora ?plantio= nao numerico', () => {
    const { result } = renderHook(() => usePlantioFiltro(plantios), { wrapper: comRota('/tarefas?plantio=abc') })
    expect(result.current.plantioId).toBeNull()
  })

  it('setPlantioId escreve ?plantio= na URL', () => {
    const { result } = renderHook(() => ({ filtro: usePlantioFiltro(plantios), location: useLocation() }), {
      wrapper: comRota('/tarefas'),
    })
    act(() => result.current.filtro.setPlantioId(2))
    expect(result.current.location.search).toBe('?plantio=2')
  })

  it('setPlantioId(null) remove o parametro da URL', () => {
    const { result } = renderHook(() => ({ filtro: usePlantioFiltro(plantios), location: useLocation() }), {
      wrapper: comRota('/tarefas?plantio=2'),
    })
    act(() => result.current.filtro.setPlantioId(null))
    expect(result.current.location.search).toBe('')
  })
})
