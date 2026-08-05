import type { Tarefa } from '../api/tarefas'
import { Badge } from './ui'

type TarefaItemProps = {
  tarefa: Tarefa
  rotulo?: string
  atrasada: boolean
  hoje?: boolean
  comBorda?: boolean
  onToggleConcluida: (concluida: boolean) => void
}

export function TarefaItem({ tarefa, rotulo, atrasada, hoje = false, comBorda = true, onToggleConcluida }: TarefaItemProps) {
  const dataFormatada = new Date(`${tarefa.data}T00:00:00`).toLocaleDateString('pt-BR')

  return (
    <label
      className={
        comBorda
          ? 'flex items-start gap-3 border-b border-dashed border-line px-1 py-3.5 last:border-0'
          : 'flex flex-1 items-start gap-3 py-1'
      }
    >
      <input
        type="checkbox"
        checked={tarefa.concluida}
        onChange={(e) => onToggleConcluida(e.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 accent-accent"
      />
      <span className="min-w-0 flex-1">
        <span
          className={
            tarefa.concluida
              ? 'block font-display font-bold text-ink-soft line-through'
              : atrasada
                ? 'block font-display font-bold text-rust'
                : 'block font-display font-bold text-ink'
          }
        >
          {tarefa.descricao}
          {rotulo && <span className="font-semibold text-ink-soft"> — {rotulo}</span>}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-soft">{dataFormatada}</span>
          {!tarefa.concluida && atrasada && <Badge tone="rust">Atrasada</Badge>}
          {!tarefa.concluida && !atrasada && hoje && <Badge tone="amber">Hoje</Badge>}
        </span>
      </span>
    </label>
  )
}
