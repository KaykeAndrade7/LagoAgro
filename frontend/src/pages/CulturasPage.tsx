import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarCulturas } from '../api/culturas'

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
    return <p>Carregando...</p>
  }

  if (culturasQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as culturas.</p>
        <button onClick={() => culturasQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const culturas = culturasQuery.data ?? []

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Culturas</h1>
      <ul>
        {culturas.map((cultura) => {
          const expandida = expandidas.has(cultura.id)
          return (
            <li key={cultura.id} className="mb-2 border p-2">
              <button onClick={() => alternarExpansao(cultura.id)} className="text-left font-semibold">
                {expandida ? '▾' : '▸'} {cultura.nome} ({cultura.ciclo_dias} dias)
              </button>
              {expandida && (
                <ul className="ml-4 mt-2">
                  {cultura.fases.map((fase) => (
                    <li key={fase.id} className="text-sm">
                      {fase.nome}: dia {fase.dia_inicio} a {fase.dia_fim}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
