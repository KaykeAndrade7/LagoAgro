import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarLancamentos,
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
  ROTULOS_SETOR,
  type LancamentoFinanceiro,
  type LancamentoFinanceiroInput,
} from '../api/lancamentos'
import { listarDiarias } from '../api/diarias'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LancamentoForm } from '../components/LancamentoForm'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; lancamento: LancamentoFinanceiro } | null

export function FinanceiroPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<LancamentoFinanceiro | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const lancamentosQuery = useQuery({ queryKey: ['lancamentos'], queryFn: listarLancamentos })
  const diariasQuery = useQuery({ queryKey: ['diarias'], queryFn: listarDiarias })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarLancamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: LancamentoFinanceiroInput }) => atualizarLancamento(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirLancamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (
    lancamentosQuery.isLoading ||
    diariasQuery.isLoading ||
    plantiosQuery.isLoading ||
    talhoesQuery.isLoading ||
    culturasQuery.isLoading
  ) {
    return <p>Carregando...</p>
  }

  if (
    lancamentosQuery.isError ||
    plantiosQuery.isError ||
    talhoesQuery.isError ||
    culturasQuery.isError
  ) {
    return (
      <div>
        <p>Nao foi possivel carregar os lancamentos.</p>
        <button
          onClick={() => {
            lancamentosQuery.refetch()
            diariasQuery.refetch()
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

  const lancamentos = lancamentosQuery.data ?? []
  const diarias = diariasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  const plantioOpcoes = plantios.map((plantio) => ({
    id: plantio.id,
    label: labelPlantio(plantios, talhoes, culturas, plantio.id),
  }))

  function mensagemExclusao(): string {
    if (!exclusaoPendente) return ''
    if (diariasQuery.isPending || diariasQuery.isError) {
      return 'Nao foi possivel verificar se ha diarias vinculadas a este lancamento. Exclua com cautela, ou tente novamente mais tarde.'
    }
    const n = diarias.filter((d) => d.lancamento === exclusaoPendente.id).length
    return n > 0
      ? `Este lancamento paga ${n} diaria(s) e nao podera ser excluido.`
      : 'Tem certeza que deseja excluir este lancamento?'
  }

  const lancamentosOrdenados = [...lancamentos].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  const totalGeral = lancamentos.reduce((soma, lancamento) => soma + Number(lancamento.valor), 0)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Financeiro</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Lançamento
        </button>
      </div>

      <p className="mb-4 font-semibold">Total: R$ {totalGeral.toFixed(2)}</p>

      {formulario?.tipo === 'novo' && (
        <LancamentoForm
          plantioOpcoes={plantioOpcoes}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {lancamentosOrdenados.map((lancamento) =>
          formulario?.tipo === 'editar' && formulario.lancamento.id === lancamento.id ? (
            <li key={lancamento.id} className="mb-2 border p-2">
              <LancamentoForm
                plantioOpcoes={plantioOpcoes}
                lancamento={lancamento}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: lancamento.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={lancamento.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {labelPlantio(plantios, talhoes, culturas, lancamento.plantio)} —{' '}
                {new Date(`${lancamento.data}T00:00:00`).toLocaleDateString('pt-BR')} — {lancamento.descricao} —{' '}
                {ROTULOS_SETOR[lancamento.setor]} — R$ {lancamento.valor}
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', lancamento })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(lancamento)
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
        titulo="Excluir lancamento"
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
