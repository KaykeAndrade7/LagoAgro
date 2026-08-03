import { apiRequest } from '../lib/api-client'

export type TipoInsumo = 'veneno' | 'adubo'

export type Insumo = {
  id: number
  nome: string
  tipo: TipoInsumo
  carencia_dias: number
}

export type InsumoInput = {
  nome: string
  tipo: TipoInsumo
  carencia_dias: number
}

export const ROTULOS_TIPO_INSUMO: Record<TipoInsumo, string> = {
  veneno: 'Veneno',
  adubo: 'Adubo',
}

export function listarInsumos(): Promise<Insumo[]> {
  return apiRequest<Insumo[]>('/insumos/')
}

export function criarInsumo(input: InsumoInput): Promise<Insumo> {
  return apiRequest<Insumo>('/insumos/', { method: 'POST', body: input })
}

export function atualizarInsumo(id: number, input: InsumoInput): Promise<Insumo> {
  return apiRequest<Insumo>(`/insumos/${id}/`, { method: 'PATCH', body: input })
}

export function excluirInsumo(id: number): Promise<void> {
  return apiRequest<void>(`/insumos/${id}/`, { method: 'DELETE' })
}
