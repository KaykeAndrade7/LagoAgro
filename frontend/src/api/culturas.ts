import { apiRequest } from '../lib/api-client'

export type FaseCultura = {
  id: number
  nome: string
  dia_inicio: number
  dia_fim: number
}

export type Cultura = {
  id: number
  nome: string
  ciclo_dias: number
  fases: FaseCultura[]
}

export function listarCulturas(): Promise<Cultura[]> {
  return apiRequest<Cultura[]>('/culturas/')
}
