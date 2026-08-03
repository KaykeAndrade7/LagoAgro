import type { Tarefa } from '../api/tarefas'

type TarefaItemProps = {
  tarefa: Tarefa
  rotulo?: string
  atrasada: boolean
  onToggleConcluida: (concluida: boolean) => void
}

export function TarefaItem({ tarefa, rotulo, atrasada, onToggleConcluida }: TarefaItemProps) {
  const dataFormatada = new Date(`${tarefa.data}T00:00:00`).toLocaleDateString('pt-BR')
  const classeTexto = atrasada ? 'text-red-600' : tarefa.concluida ? 'text-gray-400 line-through' : ''

  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={tarefa.concluida}
        onChange={(e) => onToggleConcluida(e.target.checked)}
      />
      <span className={classeTexto}>
        {tarefa.descricao}
        {rotulo && ` — ${rotulo}`} — {dataFormatada}
      </span>
    </label>
  )
}
