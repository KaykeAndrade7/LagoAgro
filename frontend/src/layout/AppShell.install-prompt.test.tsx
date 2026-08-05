import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import * as pushLib from '../lib/push'
import * as authContext from '../auth/AuthContext'

// Ao contrario de AppShell.test.tsx, este arquivo NAO mocka '../lib/install-prompt':
// o objetivo e provar a fiacao real entre o modulo (listener de module-scope no
// window) e o componente (assinatura -> estado -> botao renderizado).
vi.mock('../lib/push')
vi.mock('../auth/AuthContext')

function criarEventoBeforeInstallPrompt() {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  evento.prompt = vi.fn().mockResolvedValue(undefined)
  evento.userChoice = Promise.resolve({ outcome: 'accepted' })
  return evento
}

function renderComProviders() {
  return render(
    <MemoryRouter>
      <AppShell>
        <p>conteudo</p>
      </AppShell>
    </MemoryRouter>,
  )
}

describe('AppShell com install-prompt real', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: { id: 1, username: 'produtor1' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
  })

  afterEach(() => {
    // zera o estado de module-scope do install-prompt real para nao vazar
    // para outros arquivos de teste que rodam no mesmo worker
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
  })

  it('mostra o botao "Instalar app" quando o evento beforeinstallprompt real dispara', () => {
    renderComProviders()
    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()

    act(() => {
      window.dispatchEvent(criarEventoBeforeInstallPrompt())
    })

    expect(screen.getByText('Instalar app')).toBeInTheDocument()
  })
})
