import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarTrabalhadores,
  criarTrabalhador,
  atualizarTrabalhador,
  excluirTrabalhador,
  pagarDiariasPendentes,
  type Trabalhador,
  type TrabalhadorInput,
} from '../api/trabalhadores'
import { listarDiarias, criarDiaria, atualizarDiaria, excluirDiaria, type Diaria, type DiariaInput } from '../api/diarias'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TrabalhadorForm } from '../components/TrabalhadorForm'
import { DiariaForm } from '../components/DiariaForm'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconChevronDown,
  IconPencil,
  IconTrash,
  LoadingState,
  PageHeader,
} from '../components/ui'

type FormularioAberto =
  | { tipo: 'novo-trabalhador' }
  | { tipo: 'editar-trabalhador'; trabalhador: Trabalhador }
  | { tipo: 'nova-diaria'; trabalhadorId: number }
  | { tipo: 'editar-diaria'; diaria: Diaria }
  | null

type ExclusaoPendente = { tipo: 'trabalhador'; trabalhador: Trabalhador } | { tipo: 'diaria'; diaria: Diaria } | null

export function TrabalhadoresPage() {
  const queryClient = useQueryClient()
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<ExclusaoPendente>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [pagamentoPendente, setPagamentoPendente] = useState<Trabalhador | null>(null)
  const [erroPagamento, setErroPagamento] = useState<string | null>(null)
  const [mensagemPagamento, setMensagemPagamento] = useState<string | null>(null)

  const trabalhadoresQuery = useQuery({ queryKey: ['trabalhadores'], queryFn: listarTrabalhadores })
  const diariasQuery = useQuery({ queryKey: ['diarias'], queryFn: listarDiarias })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  function alternarExpansao(trabalhadorId: number) {
    setExpandidos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(trabalhadorId)) {
        proximo.delete(trabalhadorId)
      } else {
        proximo.add(trabalhadorId)
      }
      return proximo
    })
  }

  const criarTrabalhadorMutation = useMutation({
    mutationFn: criarTrabalhador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trabalhadores'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarTrabalhadorMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: TrabalhadorInput }) => atualizarTrabalhador(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trabalhadores'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirTrabalhadorMutation = useMutation({
    mutationFn: excluirTrabalhador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trabalhadores'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  const criarDiariaMutation = useMutation({
    mutationFn: criarDiaria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarDiariaMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: DiariaInput }) => atualizarDiaria(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirDiariaMutation = useMutation({
    mutationFn: excluirDiaria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  const pagarDiariasMutation = useMutation({
    mutationFn: pagarDiariasPendentes,
    onSuccess: (lancamentosCriados) => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setPagamentoPendente(null)
      setErroPagamento(null)
      setMensagemPagamento(
        lancamentosCriados.length > 0
          ? `${lancamentosCriados.length} lançamento(s) de mão de obra criado(s).`
          : 'Nenhuma diária pendente para pagar.',
      )
    },
    onError: (erro) => setErroPagamento(paraApiError(erro).message),
  })

  if (
    trabalhadoresQuery.isLoading ||
    diariasQuery.isLoading ||
    plantiosQuery.isLoading ||
    talhoesQuery.isLoading ||
    culturasQuery.isLoading
  ) {
    return <LoadingState />
  }

  if (
    trabalhadoresQuery.isError ||
    diariasQuery.isError ||
    plantiosQuery.isError ||
    talhoesQuery.isError ||
    culturasQuery.isError
  ) {
    return (
      <ErrorState
        message="Não foi possível carregar os trabalhadores."
        onRetry={() => {
          trabalhadoresQuery.refetch()
          diariasQuery.refetch()
          plantiosQuery.refetch()
          talhoesQuery.refetch()
          culturasQuery.refetch()
        }}
      />
    )
  }

  const trabalhadores = trabalhadoresQuery.data ?? []
  const diarias = diariasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  const plantioOpcoes = plantios.map((plantio) => ({
    id: plantio.id,
    label: labelPlantio(plantios, talhoes, culturas, plantio.id),
  }))

  function mensagemExclusao(): string {
    if (exclusaoPendente?.tipo === 'trabalhador') {
      const n = diarias.filter((d) => d.trabalhador === exclusaoPendente.trabalhador.id).length
      return n > 0
        ? `Este trabalhador tem ${n} diaria(s) registrada(s) e nao podera ser excluido.`
        : 'Tem certeza que deseja excluir este trabalhador?'
    }
    if (exclusaoPendente?.tipo === 'diaria') {
      return 'Tem certeza que deseja excluir esta diária?'
    }
    return ''
  }

  function mensagemConfirmacaoPagamento(trabalhador: Trabalhador): string {
    const plantiosPendentes = new Set(
      diarias.filter((d) => d.trabalhador === trabalhador.id && d.lancamento === null).map((d) => d.plantio),
    )
    return plantiosPendentes.size > 0
      ? `Isso vai gerar ${plantiosPendentes.size} lancamento(s) de mao de obra.`
      : 'Nenhuma diaria pendente para pagar.'
  }

  return (
    <div>
      <PageHeader
        title="Trabalhadores"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo-trabalhador' })}>
            + Trabalhador
          </Button>
        }
      />

      {mensagemPagamento && (
        <p className="mb-4 rounded-md border-2 border-accent/30 bg-accent-soft px-3 py-2 text-sm font-bold text-accent">
          {mensagemPagamento}
        </p>
      )}

      {formulario?.tipo === 'novo-trabalhador' && (
        <Card className="mb-5 p-5">
          <TrabalhadorForm
            erro={erroFormulario}
            onSubmit={(input) => criarTrabalhadorMutation.mutate(input)}
            onCancel={() => abrirFormulario(null)}
          />
        </Card>
      )}

      {trabalhadores.length === 0 && formulario?.tipo !== 'novo-trabalhador' && (
        <EmptyState>Nenhum trabalhador cadastrado ainda.</EmptyState>
      )}

      <ul className="space-y-3">
        {trabalhadores.map((trabalhador) => {
          const diariasDoTrabalhador = diarias.filter((d) => d.trabalhador === trabalhador.id)
          const expandido = expandidos.has(trabalhador.id)

          if (formulario?.tipo === 'editar-trabalhador' && formulario.trabalhador.id === trabalhador.id) {
            return (
              <li key={trabalhador.id}>
                <Card className="p-5">
                  <TrabalhadorForm
                    trabalhador={trabalhador}
                    erro={erroFormulario}
                    onSubmit={(input) => atualizarTrabalhadorMutation.mutate({ id: trabalhador.id, input })}
                    onCancel={() => abrirFormulario(null)}
                  />
                </Card>
              </li>
            )
          }

          return (
            <li key={trabalhador.id}>
              <Card>
                <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => alternarExpansao(trabalhador.id)}
                    className="flex min-w-0 items-center gap-2 text-left"
                    aria-expanded={expandido}
                  >
                    <IconChevronDown
                      className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${expandido ? '' : '-rotate-90'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display font-bold text-ink">{trabalhador.nome}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm text-ink-soft">R$ {trabalhador.valor_diaria}/diária</span>
                        {!trabalhador.ativo && <Badge tone="neutral">Inativo</Badge>}
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1 sm:shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="normal-case"
                      onClick={() => {
                        setErroPagamento(null)
                        setMensagemPagamento(null)
                        setPagamentoPendente(trabalhador)
                      }}
                    >
                      Pagar diárias pendentes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirFormulario({ tipo: 'editar-trabalhador', trabalhador })}
                    >
                      <IconPencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      onClick={() => {
                        setErroExclusao(null)
                        setExclusaoPendente({ tipo: 'trabalhador', trabalhador })
                      }}
                    >
                      <IconTrash className="h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>

                {expandido && (
                  <div className="dashed-divider px-4 pb-4 pt-3">
                    {formulario?.tipo === 'nova-diaria' && formulario.trabalhadorId === trabalhador.id && (
                      <DiariaForm
                        trabalhadorId={trabalhador.id}
                        plantioOpcoes={plantioOpcoes}
                        erro={erroFormulario}
                        onSubmit={(input) => criarDiariaMutation.mutate(input)}
                        onCancel={() => abrirFormulario(null)}
                      />
                    )}
                    {diariasDoTrabalhador.length === 0 && formulario?.tipo !== 'nova-diaria' && (
                      <p className="py-2 text-sm font-semibold text-ink-soft">Nenhuma diária registrada ainda.</p>
                    )}
                    <ul className="space-y-1">
                      {diariasDoTrabalhador.map((diaria) =>
                        formulario?.tipo === 'editar-diaria' && formulario.diaria.id === diaria.id ? (
                          <li key={diaria.id}>
                            <DiariaForm
                              trabalhadorId={trabalhador.id}
                              plantioOpcoes={plantioOpcoes}
                              diaria={diaria}
                              erro={erroFormulario}
                              onSubmit={(input) => atualizarDiariaMutation.mutate({ id: diaria.id, input })}
                              onCancel={() => abrirFormulario(null)}
                            />
                          </li>
                        ) : (
                          <li
                            key={diaria.id}
                            className="flex items-center justify-between gap-2 border-b border-dashed border-line py-2.5 last:border-0"
                          >
                            <span className="min-w-0 truncate font-display font-semibold text-ink">
                              {labelPlantio(plantios, talhoes, culturas, diaria.plantio)}
                              <span className="font-mono font-normal text-ink-soft">
                                {' '}
                                · {new Date(`${diaria.data}T00:00:00`).toLocaleDateString('pt-BR')} · R$ {diaria.valor}
                              </span>
                            </span>
                            {diaria.lancamento !== null ? (
                              <Badge tone="accent">Paga</Badge>
                            ) : (
                              <div className="flex shrink-0 gap-1">
                                <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar-diaria', diaria })}>
                                  <IconPencil className="h-4 w-4" /> Editar
                                </Button>
                                <Button
                                  variant="danger-ghost"
                                  size="sm"
                                  onClick={() => {
                                    setErroExclusao(null)
                                    setExclusaoPendente({ tipo: 'diaria', diaria })
                                  }}
                                >
                                  <IconTrash className="h-4 w-4" /> Excluir
                                </Button>
                              </div>
                            )}
                          </li>
                        ),
                      )}
                    </ul>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 px-0"
                      onClick={() => abrirFormulario({ tipo: 'nova-diaria', trabalhadorId: trabalhador.id })}
                    >
                      + Diária
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo={exclusaoPendente?.tipo === 'trabalhador' ? 'Excluir trabalhador' : 'Excluir diária'}
        mensagem={mensagemExclusao()}
        erro={erroExclusao ?? undefined}
        onConfirm={() => {
          if (exclusaoPendente?.tipo === 'trabalhador') {
            excluirTrabalhadorMutation.mutate(exclusaoPendente.trabalhador.id)
          } else if (exclusaoPendente?.tipo === 'diaria') {
            excluirDiariaMutation.mutate(exclusaoPendente.diaria.id)
          }
        }}
        onCancel={() => {
          setExclusaoPendente(null)
          setErroExclusao(null)
        }}
      />

      <ConfirmDialog
        aberto={pagamentoPendente !== null}
        titulo="Pagar diárias pendentes"
        mensagem={pagamentoPendente ? mensagemConfirmacaoPagamento(pagamentoPendente) : ''}
        erro={erroPagamento ?? undefined}
        onConfirm={() => {
          if (pagamentoPendente) pagarDiariasMutation.mutate(pagamentoPendente.id)
        }}
        onCancel={() => {
          setPagamentoPendente(null)
          setErroPagamento(null)
        }}
      />
    </div>
  )
}
