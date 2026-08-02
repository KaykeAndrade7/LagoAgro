import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarPlantios,
  criarPlantio,
  atualizarPlantio,
  excluirPlantio,
  ROTULOS_STATUS,
  type Plantio,
  type PlantioInput,
} from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlantioForm } from '../components/PlantioForm'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; plantio: Plantio } | null

export function PlantiosPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Plantio | null>(null)

  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  const criarMutation = useMutation({
    mutationFn: criarPlantio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setFormulario(null)
    },
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PlantioInput }) => atualizarPlantio(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setFormulario(null)
    },
  })

  const excluirMutation = useMutation({
    mutationFn: excluirPlantio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setExclusaoPendente(null)
    },
  })

  if (plantiosQuery.isLoading || talhoesQuery.isLoading || culturasQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (plantiosQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar os plantios.</p>
        <button onClick={() => plantiosQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  function nomeTalhao(id: number): string {
    return talhoes.find((t) => t.id === id)?.nome ?? '—'
  }
  function nomeCultura(id: number): string {
    return culturas.find((c) => c.id === id)?.nome ?? '—'
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Plantios</h1>
        <button
          onClick={() => setFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Plantio
        </button>
      </div>

      {formulario?.tipo === 'novo' && (
        <PlantioForm
          talhoes={talhoes}
          culturas={culturas}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => setFormulario(null)}
        />
      )}

      <ul>
        {plantios.map((plantio) =>
          formulario?.tipo === 'editar' && formulario.plantio.id === plantio.id ? (
            <li key={plantio.id} className="mb-2 border p-2">
              <PlantioForm
                talhoes={talhoes}
                culturas={culturas}
                plantio={plantio}
                onSubmit={(input) => atualizarMutation.mutate({ id: plantio.id, input })}
                onCancel={() => setFormulario(null)}
              />
            </li>
          ) : (
            <li key={plantio.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {nomeCultura(plantio.cultura)} — {nomeTalhao(plantio.talhao)} —{' '}
                {new Date(`${plantio.data_plantio}T00:00:00`).toLocaleDateString('pt-BR')} —{' '}
                {ROTULOS_STATUS[plantio.status]}
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => setFormulario({ tipo: 'editar', plantio })}>Editar</button>
                <button onClick={() => setExclusaoPendente(plantio)}>Excluir</button>
              </div>
            </li>
          ),
        )}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir plantio"
        mensagem="Tem certeza que deseja excluir este plantio?"
        onConfirm={() => {
          if (exclusaoPendente) excluirMutation.mutate(exclusaoPendente.id)
        }}
        onCancel={() => setExclusaoPendente(null)}
      />
    </div>
  )
}
