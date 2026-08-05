import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarLancamentos,
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
  ROTULOS_SETOR,
  type LancamentoFinanceiro,
  type LancamentoFinanceiroInput,
  type TipoLancamento,
} from '../api/lancamentos'
import { listarDiarias } from '../api/diarias'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LancamentoForm } from '../components/LancamentoForm'
import { Badge, Button, Card, EmptyState, ErrorState, IconPencil, IconTrash, LoadingState, PageHeader } from '../components/ui'

type FiltroTipo = 'todos' | TipoLancamento

function BotaoFiltro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? 'rounded-full border-2 border-ink bg-accent px-3.5 py-1.5 font-display text-sm font-bold text-accent-contrast'
          : 'rounded-full border-2 border-line bg-paper px-3.5 py-1.5 font-display text-sm font-bold text-ink-soft'
      }
    >
      {children}
    </button>
  )
}

export function FinanceiroPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<{ tipo: 'novo' } | { tipo: 'editar'; lancamento: LancamentoFinanceiro } | null>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<LancamentoFinanceiro | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroTipo>('todos')

  const lancamentosQuery = useQuery({ queryKey: ['lancamentos'], queryFn: listarLancamentos })
  const diariasQuery = useQuery({ queryKey: ['diarias'], queryFn: listarDiarias })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: typeof formulario) {
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
    return <LoadingState />
  }

  if (lancamentosQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar os lançamentos."
        onRetry={() => {
          lancamentosQuery.refetch()
          diariasQuery.refetch()
          plantiosQuery.refetch()
          talhoesQuery.refetch()
          culturasQuery.refetch()
        }}
      />
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

  // Totais sempre somam TODOS os lancamentos, independente do filtro de
  // exibicao ativo abaixo - trocar o filtro muda só a lista, nunca os totais.
  const totalGasto = lancamentos.filter((l) => l.tipo === 'gasto').reduce((soma, l) => soma + Number(l.valor), 0)
  const totalGanho = lancamentos.filter((l) => l.tipo === 'ganho').reduce((soma, l) => soma + Number(l.valor), 0)
  const saldoLiquido = totalGanho - totalGasto

  const lancamentosOrdenados = [...lancamentos].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  const lancamentosFiltrados =
    filtro === 'todos' ? lancamentosOrdenados : lancamentosOrdenados.filter((l) => l.tipo === filtro)

  return (
    <div>
      <PageHeader
        title="Financeiro"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo' })}>
            + Lançamento
          </Button>
        }
      />

      <Card className="mb-5 grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
        <div>
          <p className="text-sm font-bold text-ink-soft">Total gasto</p>
          <p className="font-mono text-lg font-semibold text-ink">R$ {totalGasto.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-ink-soft">Total ganho</p>
          <p className="font-mono text-lg font-semibold text-accent">R$ {totalGanho.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-ink-soft">Saldo líquido</p>
          <p className={`font-mono text-lg font-semibold ${saldoLiquido >= 0 ? 'text-accent' : 'text-ink'}`}>
            R$ {saldoLiquido.toFixed(2)}
          </p>
        </div>
      </Card>

      <div className="mb-5 flex gap-2">
        <BotaoFiltro ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos
        </BotaoFiltro>
        <BotaoFiltro ativo={filtro === 'gasto'} onClick={() => setFiltro('gasto')}>
          Gastos
        </BotaoFiltro>
        <BotaoFiltro ativo={filtro === 'ganho'} onClick={() => setFiltro('ganho')}>
          Ganhos
        </BotaoFiltro>
      </div>

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <LancamentoForm
            plantioOpcoes={plantioOpcoes}
            erro={erroFormulario}
            onSubmit={(input) => criarMutation.mutate(input)}
            onCancel={() => abrirFormulario(null)}
          />
        </Card>
      )}

      {lancamentosFiltrados.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhum lançamento registrado ainda.</EmptyState>}

      <ul className="space-y-3">
        {lancamentosFiltrados.map((lancamento) =>
          formulario?.tipo === 'editar' && formulario.lancamento.id === lancamento.id ? (
            <li key={lancamento.id}>
              <Card className="p-5">
                <LancamentoForm
                  plantioOpcoes={plantioOpcoes}
                  lancamento={lancamento}
                  erro={erroFormulario}
                  onSubmit={(input) => atualizarMutation.mutate({ id: lancamento.id, input })}
                  onCancel={() => abrirFormulario(null)}
                />
              </Card>
            </li>
          ) : (
            <li key={lancamento.id}>
              <Card className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-ink">{lancamento.descricao}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink-soft">
                    {labelPlantio(plantios, talhoes, culturas, lancamento.plantio)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{ROTULOS_SETOR[lancamento.setor]}</Badge>
                    <span className="font-mono text-sm text-ink-soft">
                      {new Date(`${lancamento.data}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 sm:shrink-0">
                  <span
                    className={
                      lancamento.tipo === 'ganho'
                        ? 'font-mono text-lg font-semibold text-accent'
                        : 'font-mono text-lg font-semibold text-ink'
                    }
                  >
                    {lancamento.tipo === 'ganho' ? '+' : '−'} R$ {lancamento.valor}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar', lancamento })}>
                      <IconPencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      onClick={() => {
                        setErroExclusao(null)
                        setExclusaoPendente(lancamento)
                      }}
                    >
                      <IconTrash className="h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ),
        )}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir lançamento"
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
