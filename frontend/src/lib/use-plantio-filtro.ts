import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const PARAM = 'plantio'

/**
 * Filtro por plantio preso na URL (`?plantio=ID`). Cada tela guarda o seu -
 * trocar o filtro em Colheitas nao afeta Financeiro. Um ID que nao bate com
 * nenhum plantio da lista (link antigo, plantio excluido) cai pra "todos" sem
 * erro. Usa navegacao normal, entao o botao "voltar" do navegador desfaz o
 * filtro.
 */
export function usePlantioFiltro(plantios: ReadonlyArray<{ id: number }>): {
  plantioId: number | null
  setPlantioId: (id: number | null) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const bruto = searchParams.get(PARAM)
  const numero = bruto != null && /^\d+$/.test(bruto) ? Number(bruto) : null
  const plantioId = numero != null && plantios.some((p) => p.id === numero) ? numero : null

  const setPlantioId = useCallback(
    (id: number | null) => {
      setSearchParams(
        (atual) => {
          const proximo = new URLSearchParams(atual)
          if (id == null) proximo.delete(PARAM)
          else proximo.set(PARAM, String(id))
          return proximo
        },
        { replace: false },
      )
    },
    [setSearchParams],
  )

  return { plantioId, setPlantioId }
}
