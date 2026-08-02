import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarTalhoes, criarTalhao, atualizarTalhao, excluirTalhao } from './talhoes'

describe('api/talhoes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }

  it('listarTalhoes faz GET /api/talhoes/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([talhao]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarTalhoes()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([talhao])
  })

  it('criarTalhao faz POST /api/talhoes/ com o corpo certo, incluindo propriedade', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(talhao), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }
    const result = await criarTalhao(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(talhao)
  })

  it('atualizarTalhao faz PATCH /api/talhoes/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(talhao), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarTalhao(1, { propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirTalhao faz DELETE /api/talhoes/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirTalhao(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/1/')
    expect(options.method).toBe('DELETE')
  })
})
