import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarTarefas,
  criarTarefa,
  atualizarTarefa,
  excluirTarefa,
  alterarConclusao,
  type Tarefa,
  type TarefaInput,
} from '../api/tarefas'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { hojeISO, estaAtrasada } from '../lib/datas'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TarefaForm } from '../components/TarefaForm'
import { TarefaItem } from '../components/TarefaItem'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormError,
  IconPencil,
  IconTrash,
  LoadingState,
  PageHeader,
} from '../components/ui'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; tarefa: Tarefa } | null

export function TarefasPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Tarefa | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [erroConclusao, setErroConclusao] = useState<string | null>(null)
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false)

  const tarefasQuery = useQuery({ queryKey: ['tarefas'], queryFn: listarTarefas })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarTarefa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: TarefaInput }) => atualizarTarefa(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirTarefa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  const concluirMutation = useMutation({
    mutationFn: ({ id, concluida }: { id: number; concluida: boolean }) => alterarConclusao(id, concluida),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroConclusao(null)
    },
    onError: (erro) => setErroConclusao(paraApiError(erro).message),
  })

  if (tarefasQuery.isLoading || plantiosQuery.isLoading || talhoesQuery.isLoading || culturasQuery.isLoading) {
    return <LoadingState />
  }

  if (tarefasQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar as tarefas."
        onRetry={() => {
          tarefasQuery.refetch()
          plantiosQuery.refetch()
          talhoesQuery.refetch()
          culturasQuery.refetch()
        }}
      />
    )
  }

  const tarefas = tarefasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  const plantioOpcoes = plantios.map((plantio) => ({
    id: plantio.id,
    label: labelPlantio(plantios, talhoes, culturas, plantio.id),
  }))
  const hoje = hojeISO()
  const tarefasVisiveis = (mostrarConcluidas ? tarefas : tarefas.filter((t) => !t.concluida))
    .slice()
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

  return (
    <div>
      <PageHeader
        title="Tarefas"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo' })}>
            + Tarefa
          </Button>
        }
      />

      <Button variant="ghost" size="sm" className="mb-4 px-0 normal-case" onClick={() => setMostrarConcluidas((v) => !v)}>
        {mostrarConcluidas ? 'Ocultar concluídas' : 'Ver concluídas'}
      </Button>

      <div className="mb-4">
        <FormError>{erroConclusao}</FormError>
      </div>

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <TarefaForm
            plantioOpcoes={plantioOpcoes}
            erro={erroFormulario}
            onSubmit={(input) => criarMutation.mutate(input)}
            onCancel={() => abrirFormulario(null)}
          />
        </Card>
      )}

      {tarefasVisiveis.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhuma tarefa por aqui.</EmptyState>}

      <ul className="space-y-3">
        {tarefasVisiveis.map((tarefa) =>
          formulario?.tipo === 'editar' && formulario.tarefa.id === tarefa.id ? (
            <li key={tarefa.id}>
              <Card className="p-5">
                <TarefaForm
                  plantioOpcoes={plantioOpcoes}
                  tarefa={tarefa}
                  erro={erroFormulario}
                  onSubmit={(input) => atualizarMutation.mutate({ id: tarefa.id, input })}
                  onCancel={() => abrirFormulario(null)}
                />
              </Card>
            </li>
          ) : (
            <li key={tarefa.id}>
              <Card className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                <TarefaItem
                  tarefa={tarefa}
                  rotulo={labelPlantio(plantios, talhoes, culturas, tarefa.plantio)}
                  atrasada={estaAtrasada(tarefa, hoje)}
                  hoje={tarefa.data === hoje}
                  comBorda={false}
                  onToggleConcluida={(concluida) => {
                    setErroConclusao(null)
                    concluirMutation.mutate({ id: tarefa.id, concluida })
                  }}
                />
                <div className="flex justify-end gap-1 sm:shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar', tarefa })}>
                    <IconPencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => {
                      setErroExclusao(null)
                      setExclusaoPendente(tarefa)
                    }}
                  >
                    <IconTrash className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              </Card>
            </li>
          ),
        )}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir tarefa"
        mensagem="Tem certeza que deseja excluir esta tarefa?"
        erro={erroExclusao ?? undefined}
        onConfirm={() => {
          if (exclusaoPendente) excluirMutation.mutate(exclusaoPendente.id)
        }}
        onCancel={() => {
          setExclusaoPendente(null)
          setErroExclusao(null)
        }}
      />
    </div>
  )
}
