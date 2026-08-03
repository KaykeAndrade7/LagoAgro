import { apiRequest } from '../lib/api-client'

export type Tarefa = {
  id: number
  plantio: number
  descricao: string
  data: string
  concluida: boolean
}

export type TarefaInput = {
  plantio: number
  descricao: string
  data: string
}

export function listarTarefas(): Promise<Tarefa[]> {
  return apiRequest<Tarefa[]>('/tarefas/')
}

export function criarTarefa(input: TarefaInput): Promise<Tarefa> {
  return apiRequest<Tarefa>('/tarefas/', { method: 'POST', body: input })
}

export function atualizarTarefa(id: number, input: TarefaInput): Promise<Tarefa> {
  return apiRequest<Tarefa>(`/tarefas/${id}/`, { method: 'PATCH', body: input })
}

export function excluirTarefa(id: number): Promise<void> {
  return apiRequest<void>(`/tarefas/${id}/`, { method: 'DELETE' })
}

export function alterarConclusao(id: number, concluida: boolean): Promise<Tarefa> {
  return apiRequest<Tarefa>(`/tarefas/${id}/`, { method: 'PATCH', body: { concluida } })
}
