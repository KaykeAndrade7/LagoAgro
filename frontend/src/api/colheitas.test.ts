import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarColheitas, criarColheita, atualizarColheita, excluirColheita } from './colheitas'

describe('api/colheitas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const colheita = { id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira' as const, quantidade: '10.00' }

  it('listarColheitas faz GET /api/colheitas/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([colheita]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarColheitas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([colheita])
  })

  it('criarColheita faz POST /api/colheitas/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(colheita), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, data: '2026-08-05', classificacao: 'primeira' as const, quantidade: '10.00' }
    const result = await criarColheita(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(colheita)
  })

  it('atualizarColheita faz PATCH /api/colheitas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(colheita), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarColheita(1, { plantio: 1, data: '2026-08-05', classificacao: 'segunda', quantidade: '5.00' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirColheita faz DELETE /api/colheitas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirColheita(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/1/')
    expect(options.method).toBe('DELETE')
  })
})
