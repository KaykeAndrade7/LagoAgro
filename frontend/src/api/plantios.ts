import { apiRequest } from '../lib/api-client'

export type PlantioStatus = 'em_andamento' | 'colhido' | 'cancelado'

export type Plantio = {
  id: number
  talhao: number
  cultura: number
  data_plantio: string
  status: PlantioStatus
}

export type PlantioInput = {
  talhao: number
  cultura: number
  data_plantio: string
  status: PlantioStatus
}

export const ROTULOS_STATUS: Record<PlantioStatus, string> = {
  em_andamento: 'Em andamento',
  colhido: 'Colhido',
  cancelado: 'Cancelado',
}

export function listarPlantios(): Promise<Plantio[]> {
  return apiRequest<Plantio[]>('/plantios/')
}

export function criarPlantio(input: PlantioInput): Promise<Plantio> {
  return apiRequest<Plantio>('/plantios/', { method: 'POST', body: input })
}

export function atualizarPlantio(id: number, input: PlantioInput): Promise<Plantio> {
  return apiRequest<Plantio>(`/plantios/${id}/`, { method: 'PATCH', body: input })
}

export function excluirPlantio(id: number): Promise<void> {
  return apiRequest<void>(`/plantios/${id}/`, { method: 'DELETE' })
}
