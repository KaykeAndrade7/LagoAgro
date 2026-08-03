import { apiRequest } from '../lib/api-client'

export type AplicacaoInsumo = {
  id: number
  plantio: number
  insumo: number
  data: string
  quantidade: string
}

export type AplicacaoInsumoInput = {
  plantio: number
  insumo: number
  data: string
  quantidade: string
}

export function listarAplicacoes(): Promise<AplicacaoInsumo[]> {
  return apiRequest<AplicacaoInsumo[]>('/aplicacoes-insumo/')
}

export function criarAplicacao(input: AplicacaoInsumoInput): Promise<AplicacaoInsumo> {
  return apiRequest<AplicacaoInsumo>('/aplicacoes-insumo/', { method: 'POST', body: input })
}

export function excluirAplicacao(id: number): Promise<void> {
  return apiRequest<void>(`/aplicacoes-insumo/${id}/`, { method: 'DELETE' })
}
