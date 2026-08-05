import { apiRequest } from '../lib/api-client'

export type TipoLancamento = 'gasto' | 'ganho'

export type SetorLancamento =
  | 'mao_de_obra'
  | 'insumos'
  | 'maquinario'
  | 'transporte'
  | 'manutencao'
  | 'venda_colheita'
  | 'outros'

export type LancamentoFinanceiro = {
  id: number
  plantio: number
  tipo: TipoLancamento
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export type LancamentoFinanceiroInput = {
  plantio: number
  tipo: TipoLancamento
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export const ROTULOS_TIPO: Record<TipoLancamento, string> = {
  gasto: 'Gasto',
  ganho: 'Ganho',
}

export const ROTULOS_SETOR: Record<SetorLancamento, string> = {
  mao_de_obra: 'Mão de obra',
  insumos: 'Insumos',
  maquinario: 'Maquinário/equipamentos',
  transporte: 'Transporte/frete',
  manutencao: 'Manutenção/infraestrutura',
  venda_colheita: 'Venda de colheita',
  outros: 'Outros',
}

export const SETORES_POR_TIPO: Record<TipoLancamento, SetorLancamento[]> = {
  gasto: ['mao_de_obra', 'insumos', 'maquinario', 'transporte', 'manutencao', 'outros'],
  ganho: ['venda_colheita', 'outros'],
}

export function listarLancamentos(): Promise<LancamentoFinanceiro[]> {
  return apiRequest<LancamentoFinanceiro[]>('/lancamentos-financeiros/')
}

export function criarLancamento(input: LancamentoFinanceiroInput): Promise<LancamentoFinanceiro> {
  return apiRequest<LancamentoFinanceiro>('/lancamentos-financeiros/', { method: 'POST', body: input })
}

export function atualizarLancamento(id: number, input: LancamentoFinanceiroInput): Promise<LancamentoFinanceiro> {
  return apiRequest<LancamentoFinanceiro>(`/lancamentos-financeiros/${id}/`, { method: 'PATCH', body: input })
}

export function excluirLancamento(id: number): Promise<void> {
  return apiRequest<void>(`/lancamentos-financeiros/${id}/`, { method: 'DELETE' })
}
