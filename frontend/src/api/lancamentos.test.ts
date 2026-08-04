import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarLancamentos, criarLancamento, atualizarLancamento, excluirLancamento } from './lancamentos'

describe('api/lancamentos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const lancamento = {
    id: 1,
    plantio: 1,
    valor: '150.00',
    data: '2026-08-05',
    descricao: 'Compra de mudas',
    setor: 'insumos' as const,
  }

  it('listarLancamentos faz GET /api/lancamentos-financeiros/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([lancamento]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarLancamentos()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([lancamento])
  })

  it('criarLancamento faz POST /api/lancamentos-financeiros/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(lancamento), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = {
      plantio: 1,
      valor: '150.00',
      data: '2026-08-05',
      descricao: 'Compra de mudas',
      setor: 'insumos' as const,
    }
    const result = await criarLancamento(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(lancamento)
  })

  it('atualizarLancamento faz PATCH /api/lancamentos-financeiros/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(lancamento), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = {
      plantio: 1,
      valor: '200.00',
      data: '2026-08-06',
      descricao: 'Compra de adubo',
      setor: 'insumos' as const,
    }
    const result = await atualizarLancamento(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(lancamento)
  })

  it('excluirLancamento faz DELETE /api/lancamentos-financeiros/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirLancamento(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/1/')
    expect(options.method).toBe('DELETE')
  })
})
