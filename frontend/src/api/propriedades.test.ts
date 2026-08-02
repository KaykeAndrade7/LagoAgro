import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarPropriedades, criarPropriedade, atualizarPropriedade, excluirPropriedade } from './propriedades'

describe('api/propriedades', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('listarPropriedades faz GET /api/propriedades/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ id: 1, nome: 'Sitio Bela Vista' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarPropriedades()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([{ id: 1, nome: 'Sitio Bela Vista' }])
  })

  it('criarPropriedade faz POST /api/propriedades/ com o corpo certo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 2, nome: 'Novo sitio' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await criarPropriedade({ nome: 'Novo sitio' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ nome: 'Novo sitio' }))
    expect(result).toEqual({ id: 2, nome: 'Novo sitio' })
  })

  it('atualizarPropriedade faz PATCH /api/propriedades/:id/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 1, nome: 'Nome atualizado' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await atualizarPropriedade(1, { nome: 'Nome atualizado' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/1/')
    expect(options.method).toBe('PATCH')
    expect(result).toEqual({ id: 1, nome: 'Nome atualizado' })
  })

  it('excluirPropriedade faz DELETE /api/propriedades/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirPropriedade(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/1/')
    expect(options.method).toBe('DELETE')
  })
})
