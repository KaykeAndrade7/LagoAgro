import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listarTrabalhadores,
  criarTrabalhador,
  atualizarTrabalhador,
  excluirTrabalhador,
  pagarDiariasPendentes,
} from './trabalhadores'

describe('api/trabalhadores', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const trabalhador = { id: 1, nome: 'Joao', valor_diaria: '120.00', ativo: true }

  it('listarTrabalhadores faz GET /api/trabalhadores/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([trabalhador]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarTrabalhadores()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([trabalhador])
  })

  it('criarTrabalhador faz POST /api/trabalhadores/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(trabalhador), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Joao', valor_diaria: '120.00', ativo: true }
    const result = await criarTrabalhador(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(trabalhador)
  })

  it('atualizarTrabalhador faz PATCH /api/trabalhadores/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(trabalhador), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Joao', valor_diaria: '130.00', ativo: false }
    const result = await atualizarTrabalhador(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(trabalhador)
  })

  it('excluirTrabalhador faz DELETE /api/trabalhadores/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirTrabalhador(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/1/')
    expect(options.method).toBe('DELETE')
  })

  it('pagarDiariasPendentes faz POST /api/trabalhadores/:id/pagar-diarias/ e retorna a lista de lancamentos', async () => {
    const lancamento = {
      id: 1,
      plantio: 1,
      valor: '240.00',
      data: '2026-08-05',
      descricao: 'Pagamento de diarias',
      setor: 'mao_de_obra' as const,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([lancamento]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await pagarDiariasPendentes(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/1/pagar-diarias/')
    expect(options.method).toBe('POST')
    expect(result).toEqual([lancamento])
  })
})
