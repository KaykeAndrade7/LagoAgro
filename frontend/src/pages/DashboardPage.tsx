import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { listarTarefas, alterarConclusao, type Tarefa } from '../api/tarefas'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { ApiError } from '../lib/api-client'
import { TarefaItem } from '../components/TarefaItem'

function paraApiError(erro: unknown): ApiError {
  return erro instanceof ApiError ? erro : new ApiError(0, 'Erro inesperado.')
}

// Mesmo cuidado de TarefasPage.tsx: monta "hoje" a partir dos componentes locais
// da data, nao de new Date().toISOString() (que e UTC).
function hojeISO(): string {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

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
    return <p>Carregando...</p>
  }

  if (tarefasQuery.isError || plantiosQuery.isError || talhoesQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar o painel.</p>
        <button onClick={() => tarefasQuery.refetch()}>Tentar novamente</button>
      </div>
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
      <p className="mb-4">Bem-vindo, {usuario?.username}</p>

      {erroConclusao && <p className="mb-2 text-sm text-red-600">{erroConclusao}</p>}

      {talhoesOrdenados.length === 0 && <p>Nenhuma tarefa pendente.</p>}

      {talhoesOrdenados.map((nomeTalhao) => {
        const tarefasDoTalhao = [...(gruposPorTalhao.get(nomeTalhao) ?? [])].sort((a, b) =>
          a.data < b.data ? -1 : a.data > b.data ? 1 : 0,
        )
        return (
          <div key={nomeTalhao} className="mb-4">
            <h2 className="mb-2 font-bold">{nomeTalhao}</h2>
            <ul>
              {tarefasDoTalhao.map((tarefa) => (
                <li key={tarefa.id} className="mb-1">
                  <TarefaItem
                    tarefa={tarefa}
                    atrasada={tarefa.data < hoje}
                    onToggleConcluida={(concluida) => {
                      setErroConclusao(null)
                      concluirMutation.mutate({ id: tarefa.id, concluida })
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
