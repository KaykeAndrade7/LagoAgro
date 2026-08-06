import { describe, it, expect, vi, beforeEach } from 'vitest'
import { atualizarCultura, criarCultura, excluirCultura, listarCulturas } from './culturas'

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
      somente_leitura: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([cultura]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarCulturas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([cultura])
  })

  it('criarCultura faz POST /api/culturas/ com o payload de fases', async () => {
    const cultura = {
      id: 2,
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [{ id: 5, nome: 'Muda', dia_inicio: 0, dia_fim: 15 }],
      somente_leitura: false,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(cultura), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Tomate Cereja', ciclo_dias: 70, fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 15 }] }
    const result = await criarCultura(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual(input)
    expect(result).toEqual(cultura)
  })

  it('atualizarCultura faz PATCH /api/culturas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 2 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Tomate Cereja', ciclo_dias: 75, fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 15 }] }
    await atualizarCultura(2, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/2/')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual(input)
  })

  it('excluirCultura faz DELETE /api/culturas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirCultura(2)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/2/')
    expect(options.method).toBe('DELETE')
  })
})
