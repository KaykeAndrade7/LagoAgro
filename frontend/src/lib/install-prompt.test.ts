import { describe, it, expect, vi, beforeEach } from 'vitest'
import { promptDisponivel, assinarDisponibilidade, solicitarInstalacao } from './install-prompt'

function criarEventoBeforeInstallPrompt(userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>) {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  evento.prompt = vi.fn().mockResolvedValue(undefined)
  evento.userChoice = userChoice
  return evento
}

describe('install-prompt', () => {
  beforeEach(() => {
    // garante estado limpo entre testes: se um teste anterior deixou o evento
    // capturado, um 'appinstalled' sintético zera o estado do módulo
    window.dispatchEvent(new Event('appinstalled'))
  })

  it('promptDisponivel comeca falso', () => {
    expect(promptDisponivel()).toBe(false)
  })

  it('promptDisponivel vira true depois de beforeinstallprompt', () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    expect(promptDisponivel()).toBe(true)
  })

  it('assinarDisponibilidade notifica quando beforeinstallprompt dispara', () => {
    const callback = vi.fn()
    const cancelar = assinarDisponibilidade(callback)

    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    expect(callback).toHaveBeenCalled()
    cancelar()
  })

  it('a funcao de cancelamento de assinarDisponibilidade para de notificar', () => {
    const callback = vi.fn()
    const cancelar = assinarDisponibilidade(callback)
    cancelar()

    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    expect(callback).not.toHaveBeenCalled()
  })

  it('solicitarInstalacao retorna "indisponivel" quando nao ha evento capturado', async () => {
    const resultado = await solicitarInstalacao()

    expect(resultado).toBe('indisponivel')
  })

  it('solicitarInstalacao chama prompt() e resolve com o outcome, consumindo o evento', async () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    const resultado = await solicitarInstalacao()

    expect(resultado).toBe('accepted')
    expect(promptDisponivel()).toBe(false)
  })

  it('outcome "dismissed" tambem consome o evento', async () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'dismissed' })))

    const resultado = await solicitarInstalacao()

    expect(resultado).toBe('dismissed')
    expect(promptDisponivel()).toBe(false)
  })

  it('appinstalled zera o estado mesmo sem solicitarInstalacao ter sido chamado', () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))
    expect(promptDisponivel()).toBe(true)

    window.dispatchEvent(new Event('appinstalled'))

    expect(promptDisponivel()).toBe(false)
  })
})
