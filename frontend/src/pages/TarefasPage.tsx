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
    return <p>Carregando...</p>
  }

  if (tarefasQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as tarefas.</p>
        <button
          onClick={() => {
            tarefasQuery.refetch()
            plantiosQuery.refetch()
            talhoesQuery.refetch()
            culturasQuery.refetch()
          }}
        >
          Tentar novamente
        </button>
      </div>
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Tarefas</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Tarefa
        </button>
      </div>

      <button onClick={() => setMostrarConcluidas((v) => !v)} className="mb-4 text-sm underline">
        {mostrarConcluidas ? 'Ocultar concluídas' : 'Ver concluídas'}
      </button>

      {erroConclusao && <p className="mb-2 text-sm text-red-600">{erroConclusao}</p>}

      {formulario?.tipo === 'novo' && (
        <TarefaForm
          plantioOpcoes={plantioOpcoes}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {tarefasVisiveis.map((tarefa) =>
          formulario?.tipo === 'editar' && formulario.tarefa.id === tarefa.id ? (
            <li key={tarefa.id} className="mb-2 border p-2">
              <TarefaForm
                plantioOpcoes={plantioOpcoes}
                tarefa={tarefa}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: tarefa.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={tarefa.id} className="mb-2 flex items-center justify-between border p-2">
              <TarefaItem
                tarefa={tarefa}
                rotulo={labelPlantio(plantios, talhoes, culturas, tarefa.plantio)}
                atrasada={estaAtrasada(tarefa, hoje)}
                onToggleConcluida={(concluida) => {
                  setErroConclusao(null)
                  concluirMutation.mutate({ id: tarefa.id, concluida })
                }}
              />
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', tarefa })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(tarefa)
                  }}
                >
                  Excluir
                </button>
              </div>
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
