import { apiRequest } from '../lib/api-client'

export type Diaria = {
  id: number
  trabalhador: number
  plantio: number
  data: string
  valor: string
  lancamento: number | null
}

export type DiariaInput = {
  trabalhador: number
  plantio: number
  data: string
}

export function listarDiarias(): Promise<Diaria[]> {
  return apiRequest<Diaria[]>('/diarias/')
}

export function criarDiaria(input: DiariaInput): Promise<Diaria> {
  return apiRequest<Diaria>('/diarias/', { method: 'POST', body: input })
}

export function atualizarDiaria(id: number, input: DiariaInput): Promise<Diaria> {
  return apiRequest<Diaria>(`/diarias/${id}/`, { method: 'PATCH', body: input })
}

export function excluirDiaria(id: number): Promise<void> {
  return apiRequest<void>(`/diarias/${id}/`, { method: 'DELETE' })
}
