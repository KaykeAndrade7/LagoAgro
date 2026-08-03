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
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ColheitaForm } from '../components/ColheitaForm'

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
    return <p>Carregando...</p>
  }

  if (colheitasQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as colheitas.</p>
        <button
          onClick={() => {
            colheitasQuery.refetch()
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

  const colheitas = colheitasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  function nomeTalhao(id: number): string {
    return talhoes.find((t) => t.id === id)?.nome ?? '—'
  }
  function nomeCultura(id: number): string {
    return culturas.find((c) => c.id === id)?.nome ?? '—'
  }
  function labelPlantio(plantioId: number): string {
    const plantio = plantios.find((p) => p.id === plantioId)
    if (!plantio) return '—'
    const dataFormatada = new Date(`${plantio.data_plantio}T00:00:00`).toLocaleDateString('pt-BR')
    return `${nomeCultura(plantio.cultura)} — ${nomeTalhao(plantio.talhao)} — ${dataFormatada}`
  }

  const plantioOpcoes = plantios.map((plantio) => ({ id: plantio.id, label: labelPlantio(plantio.id) }))
  const colheitasOrdenadas = [...colheitas].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Colheitas</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Colheita
        </button>
      </div>

      {formulario?.tipo === 'novo' && (
        <ColheitaForm
          plantioOpcoes={plantioOpcoes}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {colheitasOrdenadas.map((colheita) =>
          formulario?.tipo === 'editar' && formulario.colheita.id === colheita.id ? (
            <li key={colheita.id} className="mb-2 border p-2">
              <ColheitaForm
                plantioOpcoes={plantioOpcoes}
                colheita={colheita}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: colheita.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={colheita.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {labelPlantio(colheita.plantio)} —{' '}
                {new Date(`${colheita.data}T00:00:00`).toLocaleDateString('pt-BR')} —{' '}
                {ROTULOS_CLASSIFICACAO[colheita.classificacao]} — {colheita.quantidade} caixas
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', colheita })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(colheita)
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
