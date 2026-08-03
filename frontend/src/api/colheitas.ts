import { apiRequest } from '../lib/api-client'

export type ClassificacaoColheita = 'primeira' | 'segunda'

export type Colheita = {
  id: number
  plantio: number
  data: string
  classificacao: ClassificacaoColheita
  quantidade: string
}

export type ColheitaInput = {
  plantio: number
  data: string
  classificacao: ClassificacaoColheita
  quantidade: string
}

export const ROTULOS_CLASSIFICACAO: Record<ClassificacaoColheita, string> = {
  primeira: 'Primeira',
  segunda: 'Segunda',
}

export function listarColheitas(): Promise<Colheita[]> {
  return apiRequest<Colheita[]>('/colheitas/')
}

export function criarColheita(input: ColheitaInput): Promise<Colheita> {
  return apiRequest<Colheita>('/colheitas/', { method: 'POST', body: input })
}

export function atualizarColheita(id: number, input: ColheitaInput): Promise<Colheita> {
  return apiRequest<Colheita>(`/colheitas/${id}/`, { method: 'PATCH', body: input })
}

export function excluirColheita(id: number): Promise<void> {
  return apiRequest<void>(`/colheitas/${id}/`, { method: 'DELETE' })
}
