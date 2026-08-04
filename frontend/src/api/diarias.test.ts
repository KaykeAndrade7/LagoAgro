import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarDiarias, criarDiaria, atualizarDiaria, excluirDiaria } from './diarias'

describe('api/diarias', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const diaria = { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null }

  it('listarDiarias faz GET /api/diarias/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([diaria]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarDiarias()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([diaria])
  })

  it('criarDiaria faz POST /api/diarias/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(diaria), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { trabalhador: 1, plantio: 1, data: '2026-08-05' }
    const result = await criarDiaria(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(diaria)
  })

  it('atualizarDiaria faz PATCH /api/diarias/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(diaria), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { trabalhador: 1, plantio: 1, data: '2026-08-06' }
    const result = await atualizarDiaria(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(diaria)
  })

  it('excluirDiaria faz DELETE /api/diarias/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirDiaria(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/1/')
    expect(options.method).toBe('DELETE')
  })
})
