import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listarAplicacoes, criarAplicacao, excluirAplicacao, type AplicacaoInsumo } from '../api/aplicacoes'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { listarInsumos } from '../api/insumos'
import { ApiError, paraApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AplicacaoInsumoForm } from '../components/AplicacaoInsumoForm'

export function AplicacoesPage() {
  const queryClient = useQueryClient()
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<AplicacaoInsumo | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const aplicacoesQuery = useQuery({ queryKey: ['aplicacoes'], queryFn: listarAplicacoes })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })
  const insumosQuery = useQuery({ queryKey: ['insumos'], queryFn: listarInsumos })

  const criarMutation = useMutation({
    mutationFn: criarAplicacao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aplicacoes'] })
      setErroFormulario(null)
      setFormularioAberto(false)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirAplicacao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aplicacoes'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (
    aplicacoesQuery.isLoading ||
    plantiosQuery.isLoading ||
    talhoesQuery.isLoading ||
    culturasQuery.isLoading ||
    insumosQuery.isLoading
  ) {
    return <p>Carregando...</p>
  }

  if (
    aplicacoesQuery.isError ||
    plantiosQuery.isError ||
    talhoesQuery.isError ||
    culturasQuery.isError ||
    insumosQuery.isError
  ) {
    return (
      <div>
        <p>Nao foi possivel carregar as aplicacoes.</p>
        <button onClick={() => aplicacoesQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const aplicacoes = aplicacoesQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []
  const insumos = insumosQuery.data ?? []

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
  function nomeInsumo(id: number): string {
    return insumos.find((i) => i.id === id)?.nome ?? '—'
  }

  const plantioOpcoes = plantios.map((plantio) => ({ id: plantio.id, label: labelPlantio(plantio.id) }))
  const aplicacoesOrdenadas = [...aplicacoes].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Aplicações</h1>
        <button
          onClick={() => {
            setErroFormulario(null)
            setFormularioAberto(true)
          }}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Aplicação
        </button>
      </div>

      {formularioAberto && (
        <AplicacaoInsumoForm
          plantioOpcoes={plantioOpcoes}
          insumos={insumos}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => {
            setErroFormulario(null)
            setFormularioAberto(false)
          }}
        />
      )}

      <ul>
        {aplicacoesOrdenadas.map((aplicacao) => (
          <li key={aplicacao.id} className="mb-2 flex items-center justify-between border p-2">
            <span>
              {labelPlantio(aplicacao.plantio)} — {nomeInsumo(aplicacao.insumo)} —{' '}
              {new Date(`${aplicacao.data}T00:00:00`).toLocaleDateString('pt-BR')} — {aplicacao.quantidade}
            </span>
            <button
              onClick={() => {
                setErroExclusao(null)
                setExclusaoPendente(aplicacao)
              }}
              className="text-sm"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir aplicação"
        mensagem="Tem certeza que deseja excluir esta aplicação?"
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
