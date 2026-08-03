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
import { ApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InsumoForm } from '../components/InsumoForm'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; insumo: Insumo } | null

function paraApiError(erro: unknown): ApiError {
  return erro instanceof ApiError ? erro : new ApiError(0, 'Erro inesperado.')
}

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
    return <p>Carregando...</p>
  }

  if (insumosQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar os insumos.</p>
        <button onClick={() => insumosQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const insumos = insumosQuery.data ?? []
  const aplicacoes = aplicacoesQuery.data ?? []

  function mensagemExclusao(): string {
    if (!exclusaoPendente) return ''
    if (aplicacoesQuery.isError) {
      return 'Nao foi possivel verificar quantas aplicacoes usam este insumo. Exclua com cautela, ou tente novamente mais tarde.'
    }
    const n = aplicacoes.filter((a) => a.insumo === exclusaoPendente.id).length
    return n > 0
      ? `Este insumo e usado em ${n} aplicacao(oes) registrada(s) e nao podera ser excluido.`
      : 'Tem certeza que deseja excluir este insumo?'
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Insumos</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Insumo
        </button>
      </div>

      {formulario?.tipo === 'novo' && (
        <InsumoForm
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {insumos.map((insumo) =>
          formulario?.tipo === 'editar' && formulario.insumo.id === insumo.id ? (
            <li key={insumo.id} className="mb-2 border p-2">
              <InsumoForm
                insumo={insumo}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: insumo.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={insumo.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {insumo.nome} — {ROTULOS_TIPO_INSUMO[insumo.tipo]} — carencia: {insumo.carencia_dias} dia(s)
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', insumo })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(insumo)
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
