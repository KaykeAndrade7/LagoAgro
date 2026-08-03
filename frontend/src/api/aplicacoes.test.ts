import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarAplicacoes, criarAplicacao, excluirAplicacao } from './aplicacoes'

describe('api/aplicacoes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const aplicacao = { id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }

  it('listarAplicacoes faz GET /api/aplicacoes-insumo/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([aplicacao]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarAplicacoes()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/aplicacoes-insumo/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([aplicacao])
  })

  it('criarAplicacao faz POST /api/aplicacoes-insumo/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(aplicacao), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }
    const result = await criarAplicacao(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/aplicacoes-insumo/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(aplicacao)
  })

  it('excluirAplicacao faz DELETE /api/aplicacoes-insumo/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirAplicacao(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/aplicacoes-insumo/1/')
    expect(options.method).toBe('DELETE')
  })
})
