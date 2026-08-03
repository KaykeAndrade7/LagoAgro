// frontend/src/sw.ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  let dados: { title?: string; body?: string } = {}
  try {
    dados = event.data?.json() ?? {}
  } catch {
    dados = {}
  }
  const title = dados.title ?? 'LagoAgro'
  event.waitUntil(self.registration.showNotification(title, { body: dados.body ?? '' }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})

// Navegacao offline (fallback pra index.html em rotas desconhecidas) nao e
// implementada aqui de proposito - RNF02 (docs/requirements.md) diz que o
// app e sempre-online, sem exigencia de modo offline. precacheAndRoute ja
// satisfaz o criterio de instalabilidade do PWA sem esse fallback.
