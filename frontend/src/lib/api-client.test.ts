import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest, refreshAccessToken, setAccessToken, ApiError, AuthExpiredError } from './api-client'

describe('apiRequest', () => {
  beforeEach(() => {
    setAccessToken(null)
    vi.restoreAllMocks()
  })

  it('injeta Authorization quando ha token em memoria', async () => {
    setAccessToken('token-123')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/plantios/')

    const [, options] = fetchMock.mock.calls[0]
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer token-123')
  })

  it('nao injeta Authorization quando nao ha token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/plantios/')

    const [, options] = fetchMock.mock.calls[0]
    expect((options.headers as Headers).has('Authorization')).toBe(false)
  })

  it('em 401, tenta refresh uma vez e repete a chamada original', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'novo-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest('/plantios/1/')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ id: 1 })
  })

  it('se o refresh tambem falhar, lanca AuthExpiredError e nao tenta de novo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/plantios/1/')).rejects.toBeInstanceOf(AuthExpiredError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lanca ApiError com o status certo em erro que nao seja 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ detail: 'Nao encontrado.' }), { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/plantios/999/')).rejects.toMatchObject({ status: 404 } as Partial<ApiError>)
  })

  it('retorna undefined em resposta 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest('/plantios/1/', { method: 'DELETE' })

    expect(result).toBeUndefined()
  })

  it('em 401 no /auth/login/, nao tenta refresh e lanca ApiError (nao AuthExpiredError)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Credenciais invalidas.' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    let caught: unknown
    try {
      await apiRequest('/auth/login/', { method: 'POST', body: { username: 'x', password: 'errada' } })
    } catch (error) {
      caught = error
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(caught).toBeInstanceOf(ApiError)
    expect(caught).not.toBeInstanceOf(AuthExpiredError)
    expect(caught).toMatchObject({ status: 401 } as Partial<ApiError>)
  })
})

describe('refreshAccessToken', () => {
  beforeEach(() => {
    setAccessToken(null)
    vi.restoreAllMocks()
  })

  it('e single-flight: chamadas concorrentes reaproveitam a mesma promise e disparam um unico fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-unico' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toBe('token-unico')
    expect(b).toBe('token-unico')
  })
})
