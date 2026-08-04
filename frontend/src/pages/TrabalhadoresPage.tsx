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
    return <p>Carregando...</p>
  }

  if (
    trabalhadoresQuery.isError ||
    diariasQuery.isError ||
    plantiosQuery.isError ||
    talhoesQuery.isError ||
    culturasQuery.isError
  ) {
    return (
      <div>
        <p>Nao foi possivel carregar os trabalhadores.</p>
        <button
          onClick={() => {
            trabalhadoresQuery.refetch()
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
      return 'Tem certeza que deseja excluir esta diaria?'
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Trabalhadores</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo-trabalhador' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Trabalhador
        </button>
      </div>

      {mensagemPagamento && <p className="mb-2 text-sm text-green-700">{mensagemPagamento}</p>}

      {formulario?.tipo === 'novo-trabalhador' && (
        <TrabalhadorForm
          erro={erroFormulario}
          onSubmit={(input) => criarTrabalhadorMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {trabalhadores.map((trabalhador) => {
          const diariasDoTrabalhador = diarias.filter((d) => d.trabalhador === trabalhador.id)
          const expandido = expandidos.has(trabalhador.id)

          return (
            <li key={trabalhador.id} className="mb-2 border p-2">
              {formulario?.tipo === 'editar-trabalhador' && formulario.trabalhador.id === trabalhador.id ? (
                <TrabalhadorForm
                  trabalhador={trabalhador}
                  erro={erroFormulario}
                  onSubmit={(input) => atualizarTrabalhadorMutation.mutate({ id: trabalhador.id, input })}
                  onCancel={() => abrirFormulario(null)}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <button onClick={() => alternarExpansao(trabalhador.id)} className="text-left font-semibold">
                    {expandido ? '▾' : '▸'} {trabalhador.nome} — R$ {trabalhador.valor_diaria}/diária
                    {!trabalhador.ativo && ' (inativo)'}
                  </button>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => {
                        setErroPagamento(null)
                        setMensagemPagamento(null)
                        setPagamentoPendente(trabalhador)
                      }}
                    >
                      Pagar diárias pendentes
                    </button>
                    <button onClick={() => abrirFormulario({ tipo: 'editar-trabalhador', trabalhador })}>
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        setErroExclusao(null)
                        setExclusaoPendente({ tipo: 'trabalhador', trabalhador })
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}

              {expandido && (
                <div className="ml-4 mt-2">
                  {formulario?.tipo === 'nova-diaria' && formulario.trabalhadorId === trabalhador.id && (
                    <DiariaForm
                      trabalhadorId={trabalhador.id}
                      plantioOpcoes={plantioOpcoes}
                      erro={erroFormulario}
                      onSubmit={(input) => criarDiariaMutation.mutate(input)}
                      onCancel={() => abrirFormulario(null)}
                    />
                  )}
                  <ul>
                    {diariasDoTrabalhador.map((diaria) => (
                      <li key={diaria.id} className="mb-1 flex items-center justify-between">
                        {formulario?.tipo === 'editar-diaria' && formulario.diaria.id === diaria.id ? (
                          <DiariaForm
                            trabalhadorId={trabalhador.id}
                            plantioOpcoes={plantioOpcoes}
                            diaria={diaria}
                            erro={erroFormulario}
                            onSubmit={(input) => atualizarDiariaMutation.mutate({ id: diaria.id, input })}
                            onCancel={() => abrirFormulario(null)}
                          />
                        ) : (
                          <>
                            <span>
                              {labelPlantio(plantios, talhoes, culturas, diaria.plantio)} —{' '}
                              {new Date(`${diaria.data}T00:00:00`).toLocaleDateString('pt-BR')} — R$ {diaria.valor}
                            </span>
                            {diaria.lancamento !== null ? (
                              <span className="text-sm text-gray-500">Paga</span>
                            ) : (
                              <div className="flex gap-2 text-sm">
                                <button onClick={() => abrirFormulario({ tipo: 'editar-diaria', diaria })}>
                                  Editar
                                </button>
                                <button
                                  onClick={() => {
                                    setErroExclusao(null)
                                    setExclusaoPendente({ tipo: 'diaria', diaria })
                                  }}
                                >
                                  Excluir
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => abrirFormulario({ tipo: 'nova-diaria', trabalhadorId: trabalhador.id })}
                    className="mt-1 text-sm"
                  >
                    + Diária
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo={exclusaoPendente?.tipo === 'trabalhador' ? 'Excluir trabalhador' : 'Excluir diaria'}
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
