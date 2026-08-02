import { apiRequest } from '../lib/api-client'

export type Talhao = {
  id: number
  propriedade: number
  nome: string
  area: string
  tipo_solo: string
}

export type TalhaoInput = {
  propriedade: number
  nome: string
  area: string
  tipo_solo: string
}

export function listarTalhoes(): Promise<Talhao[]> {
  return apiRequest<Talhao[]>('/talhoes/')
}

export function criarTalhao(input: TalhaoInput): Promise<Talhao> {
  return apiRequest<Talhao>('/talhoes/', { method: 'POST', body: input })
}

export function atualizarTalhao(id: number, input: TalhaoInput): Promise<Talhao> {
  return apiRequest<Talhao>(`/talhoes/${id}/`, { method: 'PATCH', body: input })
}

export function excluirTalhao(id: number): Promise<void> {
  return apiRequest<void>(`/talhoes/${id}/`, { method: 'DELETE' })
}
