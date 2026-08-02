import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarPlantios, criarPlantio, atualizarPlantio, excluirPlantio } from './plantios'

describe('api/plantios', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' as const }

  it('listarPlantios faz GET /api/plantios/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([plantio]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarPlantios()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([plantio])
  })

  it('criarPlantio faz POST /api/plantios/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(plantio), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' as const }
    const result = await criarPlantio(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(plantio)
  })

  it('atualizarPlantio faz PATCH /api/plantios/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(plantio), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarPlantio(1, { talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'colhido' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirPlantio faz DELETE /api/plantios/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirPlantio(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/1/')
    expect(options.method).toBe('DELETE')
  })
})
