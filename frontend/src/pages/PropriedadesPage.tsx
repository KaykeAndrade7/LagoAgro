import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarPropriedades,
  criarPropriedade,
  atualizarPropriedade,
  excluirPropriedade,
  type Propriedade,
  type PropriedadeInput,
} from '../api/propriedades'
import {
  listarTalhoes,
  criarTalhao,
  atualizarTalhao,
  excluirTalhao,
  type Talhao,
  type TalhaoInput,
} from '../api/talhoes'
import { listarPlantios } from '../api/plantios'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PropriedadeForm } from '../components/PropriedadeForm'
import { TalhaoForm } from '../components/TalhaoForm'
import {
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
  | { tipo: 'nova-propriedade' }
  | { tipo: 'editar-propriedade'; propriedade: Propriedade }
  | { tipo: 'novo-talhao'; propriedadeId: number }
  | { tipo: 'editar-talhao'; talhao: Talhao }
  | null

type ExclusaoPendente = { tipo: 'propriedade'; propriedade: Propriedade } | { tipo: 'talhao'; talhao: Talhao } | null

export function PropriedadesPage() {
  const queryClient = useQueryClient()
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<ExclusaoPendente>(null)

  const propriedadesQuery = useQuery({ queryKey: ['propriedades'], queryFn: listarPropriedades })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })

  const criarPropriedadeMutation = useMutation({
    mutationFn: criarPropriedade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      setFormulario(null)
    },
  })

  const atualizarPropriedadeMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PropriedadeInput }) => atualizarPropriedade(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      setFormulario(null)
    },
  })

  const excluirPropriedadeMutation = useMutation({
    mutationFn: excluirPropriedade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setExclusaoPendente(null)
    },
  })

  const criarTalhaoMutation = useMutation({
    mutationFn: criarTalhao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      setFormulario(null)
    },
  })

  const atualizarTalhaoMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: TalhaoInput }) => atualizarTalhao(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      setFormulario(null)
    },
  })

  const excluirTalhaoMutation = useMutation({
    mutationFn: excluirTalhao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setExclusaoPendente(null)
    },
  })

  function alternarExpansao(propriedadeId: number) {
    setExpandidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(propriedadeId)) {
        proximo.delete(propriedadeId)
      } else {
        proximo.add(propriedadeId)
      }
      return proximo
    })
  }

  if (propriedadesQuery.isLoading || talhoesQuery.isLoading) {
    return <LoadingState />
  }

  if (propriedadesQuery.isError) {
    return <ErrorState message="Não foi possível carregar as propriedades." onRetry={() => propriedadesQuery.refetch()} />
  }

  if (talhoesQuery.isError) {
    return <ErrorState message="Não foi possível carregar os talhões." onRetry={() => talhoesQuery.refetch()} />
  }

  const propriedades = propriedadesQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const plantios = plantiosQuery.data ?? []

  function mensagemExclusao(): string {
    if (exclusaoPendente?.tipo === 'propriedade') {
      const n = talhoes.filter((t) => t.propriedade === exclusaoPendente.propriedade.id).length
      return n > 0
        ? `Isso tambem excluira ${n} talhao(oes) e todos os plantios registrados neles.`
        : 'Tem certeza que deseja excluir esta propriedade?'
    }
    if (exclusaoPendente?.tipo === 'talhao') {
      if (plantiosQuery.isError) {
        return 'Nao foi possivel verificar quantos plantios serao afetados. Exclua com cautela, ou tente novamente mais tarde.'
      }
      const n = plantios.filter((p) => p.talhao === exclusaoPendente.talhao.id).length
      return n > 0
        ? `Isso tambem excluira ${n} plantio(s) registrado(s) neste talhao.`
        : 'Tem certeza que deseja excluir este talhão?'
    }
    return ''
  }

  return (
    <div>
      <PageHeader
        title="Propriedades"
        action={
          <Button size="sm" onClick={() => setFormulario({ tipo: 'nova-propriedade' })}>
            + Propriedade
          </Button>
        }
      />

      {formulario?.tipo === 'nova-propriedade' && (
        <Card className="mb-5 p-5">
          <PropriedadeForm
            onSubmit={(input) => criarPropriedadeMutation.mutate(input)}
            onCancel={() => setFormulario(null)}
          />
        </Card>
      )}

      {propriedades.length === 0 && formulario?.tipo !== 'nova-propriedade' && (
        <EmptyState>Nenhuma propriedade cadastrada ainda.</EmptyState>
      )}

      <ul className="space-y-3">
        {propriedades.map((propriedade) => {
          const talhoesDaPropriedade = talhoes.filter((talhao) => talhao.propriedade === propriedade.id)
          const expandida = expandidas.has(propriedade.id)

          if (formulario?.tipo === 'editar-propriedade' && formulario.propriedade.id === propriedade.id) {
            return (
              <li key={propriedade.id}>
                <Card className="p-5">
                  <PropriedadeForm
                    propriedade={formulario.propriedade}
                    onSubmit={(input) => atualizarPropriedadeMutation.mutate({ id: propriedade.id, input })}
                    onCancel={() => setFormulario(null)}
                  />
                </Card>
              </li>
            )
          }

          return (
            <li key={propriedade.id}>
              <Card>
                <div className="flex items-center justify-between gap-2 px-4 py-3.5">
                  <button
                    onClick={() => alternarExpansao(propriedade.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={expandida}
                  >
                    <IconChevronDown
                      className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${expandida ? '' : '-rotate-90'}`}
                    />
                    <span className="truncate font-display text-base font-bold text-ink">{propriedade.nome}</span>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormulario({ tipo: 'editar-propriedade', propriedade })}
                    >
                      <IconPencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      onClick={() => setExclusaoPendente({ tipo: 'propriedade', propriedade })}
                    >
                      <IconTrash className="h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>

                {expandida && (
                  <div className="dashed-divider px-4 pb-4 pt-3">
                    {formulario?.tipo === 'novo-talhao' && formulario.propriedadeId === propriedade.id && (
                      <TalhaoForm
                        propriedadeId={propriedade.id}
                        onSubmit={(input) => criarTalhaoMutation.mutate(input)}
                        onCancel={() => setFormulario(null)}
                      />
                    )}
                    <ul className="space-y-1">
                      {talhoesDaPropriedade.map((talhao) =>
                        formulario?.tipo === 'editar-talhao' && formulario.talhao.id === talhao.id ? (
                          <li key={talhao.id}>
                            <TalhaoForm
                              propriedadeId={propriedade.id}
                              talhao={talhao}
                              onSubmit={(input) => atualizarTalhaoMutation.mutate({ id: talhao.id, input })}
                              onCancel={() => setFormulario(null)}
                            />
                          </li>
                        ) : (
                          <li
                            key={talhao.id}
                            className="flex items-center justify-between gap-2 border-b border-dashed border-line py-2.5 last:border-0"
                          >
                            <span className="min-w-0 truncate font-display font-semibold text-ink">
                              {talhao.nome}
                              <span className="font-mono font-normal text-ink-soft"> · {talhao.area} ha · {talhao.tipo_solo}</span>
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFormulario({ tipo: 'editar-talhao', talhao })}
                              >
                                <IconPencil className="h-4 w-4" /> Editar
                              </Button>
                              <Button
                                variant="danger-ghost"
                                size="sm"
                                onClick={() => setExclusaoPendente({ tipo: 'talhao', talhao })}
                              >
                                <IconTrash className="h-4 w-4" /> Excluir
                              </Button>
                            </div>
                          </li>
                        ),
                      )}
                    </ul>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 px-0"
                      onClick={() => setFormulario({ tipo: 'novo-talhao', propriedadeId: propriedade.id })}
                    >
                      + Talhão
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
        titulo={exclusaoPendente?.tipo === 'propriedade' ? 'Excluir propriedade' : 'Excluir talhão'}
        mensagem={mensagemExclusao()}
        onConfirm={() => {
          if (exclusaoPendente?.tipo === 'propriedade') {
            excluirPropriedadeMutation.mutate(exclusaoPendente.propriedade.id)
          } else if (exclusaoPendente?.tipo === 'talhao') {
            excluirTalhaoMutation.mutate(exclusaoPendente.talhao.id)
          }
        }}
        onCancel={() => setExclusaoPendente(null)}
      />
    </div>
  )
}
