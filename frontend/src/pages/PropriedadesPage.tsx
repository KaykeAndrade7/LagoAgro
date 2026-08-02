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
    return <p>Carregando...</p>
  }

  if (propriedadesQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as propriedades.</p>
        <button onClick={() => propriedadesQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  if (talhoesQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar os talhoes.</p>
        <button onClick={() => talhoesQuery.refetch()}>Tentar novamente</button>
      </div>
    )
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
        : 'Tem certeza que deseja excluir este talhao?'
    }
    return ''
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Propriedades</h1>
        <button
          onClick={() => setFormulario({ tipo: 'nova-propriedade' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Propriedade
        </button>
      </div>

      {formulario?.tipo === 'nova-propriedade' && (
        <PropriedadeForm
          onSubmit={(input) => criarPropriedadeMutation.mutate(input)}
          onCancel={() => setFormulario(null)}
        />
      )}
      {formulario?.tipo === 'editar-propriedade' && (
        <PropriedadeForm
          key={formulario.propriedade.id}
          propriedade={formulario.propriedade}
          onSubmit={(input) => atualizarPropriedadeMutation.mutate({ id: formulario.propriedade.id, input })}
          onCancel={() => setFormulario(null)}
        />
      )}

      <ul>
        {propriedades.map((propriedade) => {
          const talhoesDaPropriedade = talhoes.filter((talhao) => talhao.propriedade === propriedade.id)
          const expandida = expandidas.has(propriedade.id)

          return (
            <li key={propriedade.id} className="mb-2 border p-2">
              <div className="flex items-center justify-between">
                <button onClick={() => alternarExpansao(propriedade.id)} className="text-left font-semibold">
                  {expandida ? '▾' : '▸'} {propriedade.nome}
                </button>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => setFormulario({ tipo: 'editar-propriedade', propriedade })}>Editar</button>
                  <button onClick={() => setExclusaoPendente({ tipo: 'propriedade', propriedade })}>Excluir</button>
                </div>
              </div>

              {expandida && (
                <div className="ml-4 mt-2">
                  {formulario?.tipo === 'novo-talhao' && formulario.propriedadeId === propriedade.id && (
                    <TalhaoForm
                      propriedadeId={propriedade.id}
                      onSubmit={(input) => criarTalhaoMutation.mutate(input)}
                      onCancel={() => setFormulario(null)}
                    />
                  )}
                  <ul>
                    {talhoesDaPropriedade.map((talhao) => (
                      <li key={talhao.id} className="mb-1 flex items-center justify-between">
                        {formulario?.tipo === 'editar-talhao' && formulario.talhao.id === talhao.id ? (
                          <TalhaoForm
                            propriedadeId={propriedade.id}
                            talhao={talhao}
                            onSubmit={(input) => atualizarTalhaoMutation.mutate({ id: talhao.id, input })}
                            onCancel={() => setFormulario(null)}
                          />
                        ) : (
                          <>
                            <span>
                              {talhao.nome} — {talhao.area} ha ({talhao.tipo_solo})
                            </span>
                            <div className="flex gap-2 text-sm">
                              <button onClick={() => setFormulario({ tipo: 'editar-talhao', talhao })}>
                                Editar
                              </button>
                              <button onClick={() => setExclusaoPendente({ tipo: 'talhao', talhao })}>
                                Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setFormulario({ tipo: 'novo-talhao', propriedadeId: propriedade.id })}
                    className="mt-1 text-sm"
                  >
                    + Talhao
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo={exclusaoPendente?.tipo === 'propriedade' ? 'Excluir propriedade' : 'Excluir talhao'}
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
