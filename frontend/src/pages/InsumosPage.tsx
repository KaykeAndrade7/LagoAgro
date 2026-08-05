import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarInsumos,
  criarInsumo,
  atualizarInsumo,
  excluirInsumo,
  ROTULOS_TIPO_INSUMO,
  type Insumo,
  type InsumoInput,
} from '../api/insumos'
import { listarAplicacoes } from '../api/aplicacoes'
import { ApiError, paraApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InsumoForm } from '../components/InsumoForm'
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

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; insumo: Insumo } | null

export function InsumosPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Insumo | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const insumosQuery = useQuery({ queryKey: ['insumos'], queryFn: listarInsumos })
  const aplicacoesQuery = useQuery({ queryKey: ['aplicacoes'], queryFn: listarAplicacoes })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarInsumo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: InsumoInput }) => atualizarInsumo(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirInsumo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (insumosQuery.isLoading) {
    return <LoadingState />
  }

  if (insumosQuery.isError) {
    return <ErrorState message="Não foi possível carregar os insumos." onRetry={() => insumosQuery.refetch()} />
  }

  const insumos = insumosQuery.data ?? []
  const aplicacoes = aplicacoesQuery.data ?? []

  function mensagemExclusao(): string {
    if (!exclusaoPendente) return ''
    if (aplicacoesQuery.isPending || aplicacoesQuery.isError) {
      return 'Nao foi possivel verificar quantas aplicacoes usam este insumo. Exclua com cautela, ou tente novamente mais tarde.'
    }
    const n = aplicacoes.filter((a) => a.insumo === exclusaoPendente.id).length
    return n > 0
      ? `Este insumo e usado em ${n} aplicacao(oes) registrada(s) e nao podera ser excluido.`
      : 'Tem certeza que deseja excluir este insumo?'
  }

  return (
    <div>
      <PageHeader
        title="Insumos"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo' })}>
            + Insumo
          </Button>
        }
      />

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <InsumoForm erro={erroFormulario} onSubmit={(input) => criarMutation.mutate(input)} onCancel={() => abrirFormulario(null)} />
        </Card>
      )}

      {insumos.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhum insumo cadastrado ainda.</EmptyState>}

      <ul className="space-y-3">
        {insumos.map((insumo) =>
          formulario?.tipo === 'editar' && formulario.insumo.id === insumo.id ? (
            <li key={insumo.id}>
              <Card className="p-5">
                <InsumoForm
                  insumo={insumo}
                  erro={erroFormulario}
                  onSubmit={(input) => atualizarMutation.mutate({ id: insumo.id, input })}
                  onCancel={() => abrirFormulario(null)}
                />
              </Card>
            </li>
          ) : (
            <li key={insumo.id}>
              <Card className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-ink">{insumo.nome}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={insumo.tipo === 'veneno' ? 'rust' : 'accent'}>{ROTULOS_TIPO_INSUMO[insumo.tipo]}</Badge>
                    <span className="font-mono text-sm text-ink-soft">carência: {insumo.carencia_dias} dia(s)</span>
                  </div>
                </div>
                <div className="flex justify-end gap-1 sm:shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar', insumo })}>
                    <IconPencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => {
                      setErroExclusao(null)
                      setExclusaoPendente(insumo)
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
        titulo="Excluir insumo"
        mensagem={mensagemExclusao()}
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
