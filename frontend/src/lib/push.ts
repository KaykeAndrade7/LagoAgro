import { obterChavePublicaVapid, registrarPushSubscription } from '../api/push'

export type ResultadoAtivacao = 'ativado' | 'negado' | 'indisponivel'

export function suportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// `Uint8Array` e generico desde uma versao recente do TS/lib.dom, com default
// `ArrayBufferLike` que nao satisfaz o `BufferSource` esperado por
// `PushManager.subscribe()` - anotamos `<ArrayBuffer>` explicitamente pra bater
// com o tipo real que `new Uint8Array(...)` sempre produz em tempo de execucao.
function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function ativarNotificacoes(): Promise<ResultadoAtivacao> {
  if (!suportaPush()) return 'indisponivel'

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return 'negado'

  const { public_key } = await obterChavePublicaVapid()
  if (!public_key) return 'indisponivel'

  const registration = await navigator.serviceWorker.ready
  const subscriptionExistente = await registration.pushManager.getSubscription()
  const subscription =
    subscriptionExistente ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(public_key),
    }))
  const json = subscription.toJSON()
  await registrarPushSubscription({
    endpoint: json.endpoint ?? '',
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  })
  return 'ativado'
}
