import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarInsumos, criarInsumo, atualizarInsumo, excluirInsumo } from './insumos'

describe('api/insumos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const insumo = { id: 1, nome: 'Calda bordalesa', tipo: 'veneno' as const, carencia_dias: 7 }

  it('listarInsumos faz GET /api/insumos/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([insumo]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarInsumos()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([insumo])
  })

  it('criarInsumo faz POST /api/insumos/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(insumo), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Calda bordalesa', tipo: 'veneno' as const, carencia_dias: 7 }
    const result = await criarInsumo(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(insumo)
  })

  it('atualizarInsumo faz PATCH /api/insumos/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(insumo), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarInsumo(1, { nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 10 })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirInsumo faz DELETE /api/insumos/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirInsumo(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/1/')
    expect(options.method).toBe('DELETE')
  })
})
