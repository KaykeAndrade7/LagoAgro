import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { listarTarefas, alterarConclusao, type Tarefa } from '../api/tarefas'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { paraApiError } from '../lib/api-client'
import { hojeISO, estaAtrasada } from '../lib/datas'
import { TarefaItem } from '../components/TarefaItem'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui'

export function DashboardPage() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const [erroConclusao, setErroConclusao] = useState<string | null>(null)

  const tarefasQuery = useQuery({ queryKey: ['tarefas'], queryFn: listarTarefas })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })

  const concluirMutation = useMutation({
    mutationFn: ({ id, concluida }: { id: number; concluida: boolean }) => alterarConclusao(id, concluida),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroConclusao(null)
    },
    onError: (erro) => setErroConclusao(paraApiError(erro).message),
  })

  if (tarefasQuery.isLoading || plantiosQuery.isLoading || talhoesQuery.isLoading) {
    return <LoadingState />
  }

  if (tarefasQuery.isError || plantiosQuery.isError || talhoesQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar o painel."
        onRetry={() => {
          tarefasQuery.refetch()
          plantiosQuery.refetch()
          talhoesQuery.refetch()
        }}
      />
    )
  }

  const tarefas = tarefasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const hoje = hojeISO()

  function nomeTalhaoDoPlantio(plantioId: number): string {
    const plantio = plantios.find((p) => p.id === plantioId)
    if (!plantio) return '—'
    return talhoes.find((t) => t.id === plantio.talhao)?.nome ?? '—'
  }

  const pendentes = tarefas.filter((t) => !t.concluida)
  const gruposPorTalhao = new Map<string, Tarefa[]>()
  for (const tarefa of pendentes) {
    const nomeTalhao = nomeTalhaoDoPlantio(tarefa.plantio)
    const grupo = gruposPorTalhao.get(nomeTalhao) ?? []
    grupo.push(tarefa)
    gruposPorTalhao.set(nomeTalhao, grupo)
  }
  const talhoesOrdenados = [...gruposPorTalhao.keys()].sort((a, b) => a.localeCompare(b))

  return (
    <div>
      <PageHeader title="Painel" />
      <p className="-mt-3 mb-6 font-display font-semibold text-ink-soft">Bem-vindo, {usuario?.username}</p>

      {erroConclusao && (
        <p role="alert" className="mb-4 rounded-md border-2 border-rust/30 bg-rust-bg px-3 py-2 text-sm font-bold text-rust">
          {erroConclusao}
        </p>
      )}

      {talhoesOrdenados.length === 0 && <EmptyState>Nenhuma tarefa pendente.</EmptyState>}

      <div className="space-y-5">
        {talhoesOrdenados.map((nomeTalhao) => {
          const tarefasDoTalhao = [...(gruposPorTalhao.get(nomeTalhao) ?? [])].sort((a, b) =>
            a.data < b.data ? -1 : a.data > b.data ? 1 : 0,
          )
          return (
            <Card key={nomeTalhao} className="ticket-paper px-5 pt-4 pb-1 pl-9">
              <h2 className="mb-1 font-display text-lg font-black uppercase tracking-tight text-ink">{nomeTalhao}</h2>
              <div>
                {tarefasDoTalhao.map((tarefa) => (
                  <TarefaItem
                    key={tarefa.id}
                    tarefa={tarefa}
                    atrasada={estaAtrasada(tarefa, hoje)}
                    hoje={tarefa.data === hoje}
                    onToggleConcluida={(concluida) => {
                      setErroConclusao(null)
                      concluirMutation.mutate({ id: tarefa.id, concluida })
                    }}
                  />
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
