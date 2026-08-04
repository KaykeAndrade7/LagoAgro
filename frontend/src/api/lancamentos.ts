import { apiRequest } from '../lib/api-client'

export type SetorLancamento = 'mao_de_obra' | 'insumos' | 'maquinario' | 'transporte' | 'manutencao' | 'outros'

export type LancamentoFinanceiro = {
  id: number
  plantio: number
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export type LancamentoFinanceiroInput = {
  plantio: number
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export const ROTULOS_SETOR: Record<SetorLancamento, string> = {
  mao_de_obra: 'Mão de obra',
  insumos: 'Insumos',
  maquinario: 'Maquinário/equipamentos',
  transporte: 'Transporte/frete',
  manutencao: 'Manutenção/infraestrutura',
  outros: 'Outros',
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
