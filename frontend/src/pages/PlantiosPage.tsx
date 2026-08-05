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
  type PlantioStatus,
} from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlantioForm } from '../components/PlantioForm'
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
  type BadgeTone,
} from '../components/ui'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; plantio: Plantio } | null

const TOM_STATUS: Record<PlantioStatus, BadgeTone> = {
  em_andamento: 'accent',
  colhido: 'neutral',
  cancelado: 'rust',
}

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
    return <LoadingState />
  }

  if (plantiosQuery.isError) {
    return <ErrorState message="Não foi possível carregar os plantios." onRetry={() => plantiosQuery.refetch()} />
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
      <PageHeader
        title="Plantios"
        action={
          <Button size="sm" onClick={() => setFormulario({ tipo: 'novo' })}>
            + Plantio
          </Button>
        }
      />

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <PlantioForm
            talhoes={talhoes}
            culturas={culturas}
            onSubmit={(input) => criarMutation.mutate(input)}
            onCancel={() => setFormulario(null)}
          />
        </Card>
      )}

      {plantios.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhum plantio registrado ainda.</EmptyState>}

      <ul className="space-y-3">
        {plantios.map((plantio) =>
          formulario?.tipo === 'editar' && formulario.plantio.id === plantio.id ? (
            <li key={plantio.id}>
              <Card className="p-5">
                <PlantioForm
                  talhoes={talhoes}
                  culturas={culturas}
                  plantio={plantio}
                  onSubmit={(input) => atualizarMutation.mutate({ id: plantio.id, input })}
                  onCancel={() => setFormulario(null)}
                />
              </Card>
            </li>
          ) : (
            <li key={plantio.id}>
              <Card className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-ink">
                    {nomeCultura(plantio.cultura)} — {nomeTalhao(plantio.talhao)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-ink-soft">
                      {new Date(`${plantio.data_plantio}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                    <Badge tone={TOM_STATUS[plantio.status]}>{ROTULOS_STATUS[plantio.status]}</Badge>
                  </div>
                </div>
                <div className="flex justify-end gap-1 sm:shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setFormulario({ tipo: 'editar', plantio })}>
                    <IconPencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="danger-ghost" size="sm" onClick={() => setExclusaoPendente(plantio)}>
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
