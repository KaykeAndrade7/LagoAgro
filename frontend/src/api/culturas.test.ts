import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarCulturas } from './culturas'

describe('api/culturas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('listarCulturas faz GET /api/culturas/ e retorna as fases aninhadas', async () => {
    const cultura = {
      id: 1,
      nome: 'Tomate',
      ciclo_dias: 90,
      fases: [{ id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([cultura]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarCulturas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([cultura])
  })
})
