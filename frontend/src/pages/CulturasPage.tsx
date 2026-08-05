import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarCulturas } from '../api/culturas'
import { Card, EmptyState, ErrorState, IconChevronDown, LoadingState, PageHeader } from '../components/ui'

export function CulturasPage() {
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
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

  if (culturasQuery.isLoading) {
    return <LoadingState />
  }

  if (culturasQuery.isError) {
    return <ErrorState message="Não foi possível carregar as culturas." onRetry={() => culturasQuery.refetch()} />
  }

  const culturas = culturasQuery.data ?? []

  return (
    <div>
      <PageHeader title="Culturas" />

      {culturas.length === 0 && <EmptyState>Nenhuma cultura cadastrada ainda.</EmptyState>}

      <ul className="space-y-3">
        {culturas.map((cultura) => {
          const expandida = expandidas.has(cultura.id)
          return (
            <li key={cultura.id}>
              <Card>
                <button
                  onClick={() => alternarExpansao(cultura.id)}
                  className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
                  aria-expanded={expandida}
                >
                  <IconChevronDown
                    className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${expandida ? '' : '-rotate-90'}`}
                  />
                  <span className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">
                    {cultura.nome} ({cultura.ciclo_dias} dias)
                  </span>
                </button>
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
    </div>
  )
}
