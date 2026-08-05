import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarColheitas,
  criarColheita,
  atualizarColheita,
  excluirColheita,
  ROTULOS_CLASSIFICACAO,
  type Colheita,
  type ColheitaInput,
} from '../api/colheitas'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ColheitaForm } from '../components/ColheitaForm'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconPencil,
  IconTrash,
  LoadingState,
  PageHeader,
} from '../components/ui'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; colheita: Colheita } | null

export function ColheitasPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Colheita | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const colheitasQuery = useQuery({ queryKey: ['colheitas'], queryFn: listarColheitas })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarColheita,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: ColheitaInput }) => atualizarColheita(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirColheita,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (colheitasQuery.isLoading || plantiosQuery.isLoading || talhoesQuery.isLoading || culturasQuery.isLoading) {
    return <LoadingState />
  }

  if (colheitasQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar as colheitas."
        onRetry={() => {
          colheitasQuery.refetch()
          plantiosQuery.refetch()
          talhoesQuery.refetch()
          culturasQuery.refetch()
        }}
      />
    )
  }

  const colheitas = colheitasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  const plantioOpcoes = plantios.map((plantio) => ({
    id: plantio.id,
    label: labelPlantio(plantios, talhoes, culturas, plantio.id),
  }))
  const colheitasOrdenadas = [...colheitas].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  return (
    <div>
      <PageHeader
        title="Colheitas"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo' })}>
            + Colheita
          </Button>
        }
      />

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <ColheitaForm
            plantioOpcoes={plantioOpcoes}
            erro={erroFormulario}
            onSubmit={(input) => criarMutation.mutate(input)}
            onCancel={() => abrirFormulario(null)}
          />
        </Card>
      )}

      {colheitasOrdenadas.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhuma colheita registrada ainda.</EmptyState>}

      <ul className="space-y-3">
        {colheitasOrdenadas.map((colheita) =>
          formulario?.tipo === 'editar' && formulario.colheita.id === colheita.id ? (
            <li key={colheita.id}>
              <Card className="p-5">
                <ColheitaForm
                  plantioOpcoes={plantioOpcoes}
                  colheita={colheita}
                  erro={erroFormulario}
                  onSubmit={(input) => atualizarMutation.mutate({ id: colheita.id, input })}
                  onCancel={() => abrirFormulario(null)}
                />
              </Card>
            </li>
          ) : (
            <li key={colheita.id}>
              <Card className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-ink">
                    {labelPlantio(plantios, talhoes, culturas, colheita.plantio)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={colheita.classificacao === 'primeira' ? 'accent' : 'neutral'}>
                      {ROTULOS_CLASSIFICACAO[colheita.classificacao]}
                    </Badge>
                    <span className="font-mono text-sm text-ink-soft">
                      {new Date(`${colheita.data}T00:00:00`).toLocaleDateString('pt-BR')} · {colheita.quantidade} caixas
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-1 sm:shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar', colheita })}>
                    <IconPencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => {
                      setErroExclusao(null)
                      setExclusaoPendente(colheita)
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
        titulo="Excluir colheita"
        mensagem="Tem certeza que deseja excluir esta colheita?"
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
