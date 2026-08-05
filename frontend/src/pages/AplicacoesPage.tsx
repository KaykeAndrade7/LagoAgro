import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listarAplicacoes, criarAplicacao, excluirAplicacao, type AplicacaoInsumo } from '../api/aplicacoes'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { listarInsumos } from '../api/insumos'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AplicacaoInsumoForm } from '../components/AplicacaoInsumoForm'
import { Button, Card, EmptyState, ErrorState, IconTrash, LoadingState, PageHeader } from '../components/ui'

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
    return <LoadingState />
  }

  if (
    aplicacoesQuery.isError ||
    plantiosQuery.isError ||
    talhoesQuery.isError ||
    culturasQuery.isError ||
    insumosQuery.isError
  ) {
    return <ErrorState message="Não foi possível carregar as aplicações." onRetry={() => aplicacoesQuery.refetch()} />
  }

  const aplicacoes = aplicacoesQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []
  const insumos = insumosQuery.data ?? []

  function nomeInsumo(id: number): string {
    return insumos.find((i) => i.id === id)?.nome ?? '—'
  }

  const plantioOpcoes = plantios.map((plantio) => ({
    id: plantio.id,
    label: labelPlantio(plantios, talhoes, culturas, plantio.id),
  }))
  const aplicacoesOrdenadas = [...aplicacoes].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  return (
    <div>
      <PageHeader
        title="Aplicações"
        action={
          <Button
            size="sm"
            onClick={() => {
              setErroFormulario(null)
              setFormularioAberto(true)
            }}
          >
            + Aplicação
          </Button>
        }
      />

      {formularioAberto && (
        <Card className="mb-5 p-5">
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
        </Card>
      )}

      {aplicacoesOrdenadas.length === 0 && !formularioAberto && <EmptyState>Nenhuma aplicação registrada ainda.</EmptyState>}

      <ul className="space-y-3">
        {aplicacoesOrdenadas.map((aplicacao) => (
          <li key={aplicacao.id}>
            <Card className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold text-ink">
                  {labelPlantio(plantios, talhoes, culturas, aplicacao.plantio)}
                </p>
                <p className="mt-1 font-semibold text-ink-soft">
                  {nomeInsumo(aplicacao.insumo)}{' '}
                  <span className="font-mono text-sm">
                    · {new Date(`${aplicacao.data}T00:00:00`).toLocaleDateString('pt-BR')} · {aplicacao.quantidade}
                  </span>
                </p>
              </div>
              <Button
                variant="danger-ghost"
                size="sm"
                className="self-end sm:self-auto"
                onClick={() => {
                  setErroExclusao(null)
                  setExclusaoPendente(aplicacao)
                }}
              >
                <IconTrash className="h-4 w-4" /> Excluir
              </Button>
            </Card>
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
