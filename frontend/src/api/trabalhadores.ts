import { apiRequest } from '../lib/api-client'
import type { LancamentoFinanceiro } from './lancamentos'

export type Trabalhador = {
  id: number
  nome: string
  valor_diaria: string
  ativo: boolean
}

export type TrabalhadorInput = {
  nome: string
  valor_diaria: string
  ativo: boolean
}

export function listarTrabalhadores(): Promise<Trabalhador[]> {
  return apiRequest<Trabalhador[]>('/trabalhadores/')
}

export function criarTrabalhador(input: TrabalhadorInput): Promise<Trabalhador> {
  return apiRequest<Trabalhador>('/trabalhadores/', { method: 'POST', body: input })
}

export function atualizarTrabalhador(id: number, input: TrabalhadorInput): Promise<Trabalhador> {
  return apiRequest<Trabalhador>(`/trabalhadores/${id}/`, { method: 'PATCH', body: input })
}

export function excluirTrabalhador(id: number): Promise<void> {
  return apiRequest<void>(`/trabalhadores/${id}/`, { method: 'DELETE' })
}

export function pagarDiariasPendentes(trabalhadorId: number): Promise<LancamentoFinanceiro[]> {
  return apiRequest<LancamentoFinanceiro[]>(`/trabalhadores/${trabalhadorId}/pagar-diarias/`, { method: 'POST' })
}
