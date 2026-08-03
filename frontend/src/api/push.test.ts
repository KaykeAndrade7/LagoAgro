import { describe, it, expect, vi, beforeEach } from 'vitest'
import { obterChavePublicaVapid, registrarPushSubscription } from './push'

describe('api/push', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('obterChavePublicaVapid faz GET /api/notificacoes/chave-publica/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ public_key: 'chave-123' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await obterChavePublicaVapid()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/notificacoes/chave-publica/')
    expect(options.method).toBe('GET')
    expect(result).toEqual({ public_key: 'chave-123' })
  })

  it('registrarPushSubscription faz POST /api/push-subscriptions/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { endpoint: 'https://push.example/1', p256dh: 'chave-p256dh', auth: 'chave-auth' }
    const result = await registrarPushSubscription(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/push-subscriptions/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual({ id: 1 })
  })
})
