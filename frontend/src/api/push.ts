import { apiRequest } from '../lib/api-client'

export function obterChavePublicaVapid(): Promise<{ public_key: string }> {
  return apiRequest<{ public_key: string }>('/notificacoes/chave-publica/')
}

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export function registrarPushSubscription(input: PushSubscriptionInput): Promise<{ id: number }> {
  return apiRequest<{ id: number }>('/push-subscriptions/', { method: 'POST', body: input })
}
