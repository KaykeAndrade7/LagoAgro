import type { Plantio } from '../api/plantios'
import type { Talhao } from '../api/talhoes'
import type { Cultura } from '../api/culturas'

export function nomeTalhao(talhoes: Talhao[], id: number): string {
  return talhoes.find((t) => t.id === id)?.nome ?? '—'
}

export function nomeCultura(culturas: Cultura[], id: number): string {
  return culturas.find((c) => c.id === id)?.nome ?? '—'
}

export function labelPlantio(plantios: Plantio[], talhoes: Talhao[], culturas: Cultura[], plantioId: number): string {
  const plantio = plantios.find((p) => p.id === plantioId)
  if (!plantio) return '—'
  const dataFormatada = new Date(`${plantio.data_plantio}T00:00:00`).toLocaleDateString('pt-BR')
  return `${nomeCultura(culturas, plantio.cultura)} — ${nomeTalhao(talhoes, plantio.talhao)} — ${dataFormatada}`
}
