import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  atualizarCultura,
  criarCultura,
  excluirCultura,
  listarCulturas,
  type Cultura,
  type CulturaInput,
} from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CulturaForm } from '../components/CulturaForm'
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

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; cultura: Cultura } | null

export function CulturasPage() {
  const queryClient = useQueryClient()
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Cultura | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function alternarExpansao(culturaId: number) {
    setExpandidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(culturaId)) {
        proximo.delete(culturaId)
      } else {
        proximo.add(culturaId)
      }
      return proximo
    })
  }

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: (data: CulturaInput) => criarCultura(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culturas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: CulturaInput }) => atualizarCultura(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culturas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: (id: number) => excluirCultura(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culturas'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (culturasQuery.isLoading) {
    return <LoadingState />
  }

  if (culturasQuery.isError) {
    return <ErrorState message="Não foi possível carregar as culturas." onRetry={() => culturasQuery.refetch()} />
  }

  const culturas = culturasQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="Culturas"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo' })}>
            + Cultura
          </Button>
        }
      />

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <CulturaForm
            erro={erroFormulario}
            onSubmit={(input) => criarMutation.mutate(input)}
            onCancel={() => abrirFormulario(null)}
          />
        </Card>
      )}

      {culturas.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhuma cultura cadastrada ainda.</EmptyState>}

      <ul className="space-y-3">
        {culturas.map((cultura) => {
          if (formulario?.tipo === 'editar' && formulario.cultura.id === cultura.id) {
            return (
              <li key={cultura.id}>
                <Card className="p-5">
                  <CulturaForm
                    cultura={cultura}
                    erro={erroFormulario}
                    onSubmit={(input) => atualizarMutation.mutate({ id: cultura.id, input })}
                    onCancel={() => abrirFormulario(null)}
                  />
                </Card>
              </li>
            )
          }

          const expandida = expandidas.has(cultura.id)
          return (
            <li key={cultura.id}>
              <Card>
                <div className="flex items-center gap-2 px-4 py-3.5">
                  <button
                    onClick={() => alternarExpansao(cultura.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={expandida}
                  >
                    <IconChevronDown
                      className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${expandida ? '' : '-rotate-90'}`}
                    />
                    <span className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">
                      {cultura.nome} ({cultura.ciclo_dias} dias)
                    </span>
                  </button>
                  {!cultura.somente_leitura && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar', cultura })}>
                        <IconPencil className="h-4 w-4" /> Editar
                      </Button>
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        onClick={() => {
                          setErroExclusao(null)
                          setExclusaoPendente(cultura)
                        }}
                      >
                        <IconTrash className="h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  )}
                </div>
                {expandida && (
                  <ul className="dashed-divider px-4 pb-3 pt-1">
                    {cultura.fases.map((fase) => (
                      <li
                        key={fase.id}
                        className="border-b border-dashed border-line py-2.5 font-display font-semibold text-ink last:border-0"
                      >
                        {fase.nome}: dia {fase.dia_inicio} a {fase.dia_fim}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir cultura"
        mensagem="Tem certeza que deseja excluir esta cultura?"
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
