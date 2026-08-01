// frontend/src/sw.ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Handlers de 'push' e 'notificationclick' (ADR 005) sao adicionados numa
// fatia futura, quando a UI de tarefas existir pra mostrar o que a
// notificacao abre - ver docs/superpowers/specs/2026-08-01-frontend-scaffold-auth-design.md.
