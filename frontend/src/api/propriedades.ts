import { apiRequest } from '../lib/api-client'

export type Propriedade = {
  id: number
  nome: string
}

export type PropriedadeInput = {
  nome: string
}

export function listarPropriedades(): Promise<Propriedade[]> {
  return apiRequest<Propriedade[]>('/propriedades/')
}

export function criarPropriedade(input: PropriedadeInput): Promise<Propriedade> {
  return apiRequest<Propriedade>('/propriedades/', { method: 'POST', body: input })
}

export function atualizarPropriedade(id: number, input: PropriedadeInput): Promise<Propriedade> {
  return apiRequest<Propriedade>(`/propriedades/${id}/`, { method: 'PATCH', body: input })
}

export function excluirPropriedade(id: number): Promise<void> {
  return apiRequest<void>(`/propriedades/${id}/`, { method: 'DELETE' })
}
