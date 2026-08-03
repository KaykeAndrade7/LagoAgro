import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { suportaPush, ativarNotificacoes } from './push'
import * as pushApi from '../api/push'

vi.mock('../api/push')

function definirServiceWorkerMock(resolverSubscribe: () => Promise<{ toJSON: () => unknown }>) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve({
        pushManager: { subscribe: vi.fn(resolverSubscribe) },
      }),
    },
    configurable: true,
  })
}

function removerServiceWorkerMock() {
  // @ts-expect-error apagando propriedade de teste que nao existe por padrao no jsdom
  delete navigator.serviceWorker
}

describe('suportaPush', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    removerServiceWorkerMock()
  })

  it('retorna false quando as APIs de push nao existem (padrao do jsdom, sem stub nenhum)', () => {
    expect(suportaPush()).toBe(false)
  })

  it('retorna true quando serviceWorker, PushManager e Notification existem', () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn() })
    definirServiceWorkerMock(async () => ({ toJSON: () => ({}) }))

    expect(suportaPush()).toBe(true)
  })
})

describe('ativarNotificacoes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    removerServiceWorkerMock()
  })

  it('retorna "indisponivel" quando o navegador nao suporta push', async () => {
    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('indisponivel')
  })

  it('retorna "negado" quando a permissao nao e concedida', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') })
    definirServiceWorkerMock(async () => ({ toJSON: () => ({}) }))

    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('negado')
  })

  it('retorna "indisponivel" quando a chave publica vem vazia', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    definirServiceWorkerMock(async () => ({ toJSON: () => ({}) }))
    vi.mocked(pushApi.obterChavePublicaVapid).mockResolvedValue({ public_key: '' })

    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('indisponivel')
  })

  it('assina e registra no backend quando tudo da certo, retornando "ativado"', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    definirServiceWorkerMock(async () => ({
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p256dh-valor', auth: 'auth-valor' } }),
    }))
    vi.mocked(pushApi.obterChavePublicaVapid).mockResolvedValue({ public_key: 'QUJD' })
    vi.mocked(pushApi.registrarPushSubscription).mockResolvedValue({ id: 1 })

    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('ativado')
    expect(pushApi.registrarPushSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-valor',
      auth: 'auth-valor',
    })
  })
})
