import { describe, it, expect } from 'vitest'
import { nomeTalhao, nomeCultura, labelPlantio } from './plantio-labels'

const talhoes = [{ id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }]
const culturas = [{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }]
const plantios = [{ id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }]

describe('nomeTalhao', () => {
  it('retorna o nome do talhao pelo id', () => {
    expect(nomeTalhao(talhoes, 1)).toBe('Talhao 1')
  })

  it('retorna travessao quando o talhao nao existe', () => {
    expect(nomeTalhao(talhoes, 999)).toBe('—')
  })
})

describe('nomeCultura', () => {
  it('retorna o nome da cultura pelo id', () => {
    expect(nomeCultura(culturas, 1)).toBe('Tomate')
  })

  it('retorna travessao quando a cultura nao existe', () => {
    expect(nomeCultura(culturas, 999)).toBe('—')
  })
})

describe('labelPlantio', () => {
  it('monta o label cultura — talhao — data', () => {
    expect(labelPlantio(plantios, talhoes, culturas, 1)).toBe('Tomate — Talhao 1 — 01/07/2026')
  })

  it('retorna travessao quando o plantio nao existe', () => {
    expect(labelPlantio(plantios, talhoes, culturas, 999)).toBe('—')
  })
})
