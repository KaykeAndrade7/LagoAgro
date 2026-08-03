import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarTarefas, criarTarefa, atualizarTarefa, excluirTarefa, alterarConclusao } from './tarefas'

describe('api/tarefas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const tarefa = { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }

  it('listarTarefas faz GET /api/tarefas/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([tarefa]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarTarefas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([tarefa])
  })

  it('criarTarefa faz POST /api/tarefas/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(tarefa), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, descricao: 'Regar', data: '2026-08-05' }
    const result = await criarTarefa(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(tarefa)
  })

  it('atualizarTarefa faz PATCH /api/tarefas/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(tarefa), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, descricao: 'Regar de manha', data: '2026-08-06' }
    const result = await atualizarTarefa(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(tarefa)
  })

  it('excluirTarefa faz DELETE /api/tarefas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirTarefa(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/1/')
    expect(options.method).toBe('DELETE')
  })

  it('alterarConclusao faz PATCH /api/tarefas/:id/ so com {concluida}', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ...tarefa, concluida: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await alterarConclusao(1, true)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify({ concluida: true }))
    expect(result).toEqual({ ...tarefa, concluida: true })
  })
})
