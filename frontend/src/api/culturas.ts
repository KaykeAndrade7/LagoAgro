import { apiRequest } from '../lib/api-client'

export type FaseCultura = {
  id: number
  nome: string
  dia_inicio: number
  dia_fim: number
}

export type FaseCulturaInput = {
  nome: string
  dia_inicio: number
  dia_fim: number
}

export type Cultura = {
  id: number
  nome: string
  ciclo_dias: number
  fases: FaseCultura[]
  somente_leitura: boolean
}

export type CulturaInput = {
  nome: string
  ciclo_dias: number
  fases: FaseCulturaInput[]
}

export function listarCulturas(): Promise<Cultura[]> {
  return apiRequest<Cultura[]>('/culturas/')
}

export function criarCultura(input: CulturaInput): Promise<Cultura> {
  return apiRequest<Cultura>('/culturas/', { method: 'POST', body: input })
}

export function atualizarCultura(id: number, input: CulturaInput): Promise<Cultura> {
  return apiRequest<Cultura>(`/culturas/${id}/`, { method: 'PATCH', body: input })
}

export function excluirCultura(id: number): Promise<void> {
  return apiRequest<void>(`/culturas/${id}/`, { method: 'DELETE' })
}
