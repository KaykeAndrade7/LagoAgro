import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import * as pushLib from '../lib/push'
import * as authContext from '../auth/AuthContext'
import * as installPromptLib from '../lib/install-prompt'

vi.mock('../lib/push')
vi.mock('../auth/AuthContext')
vi.mock('../lib/install-prompt')

function renderComProviders() {
  return render(
    <MemoryRouter>
      <AppShell>
        <p>conteudo</p>
      </AppShell>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: { id: 1, username: 'produtor1' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(false)
    vi.mocked(installPromptLib.assinarDisponibilidade).mockReturnValue(() => {})
  })

  it('nao mostra o botao de notificacoes quando o navegador nao suporta push', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)

    renderComProviders()

    expect(screen.queryByText('Ativar notificações')).not.toBeInTheDocument()
  })

  it('clique bem-sucedido troca o botao por "Notificações ativadas"', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(true)
    vi.mocked(pushLib.ativarNotificacoes).mockResolvedValue('ativado')

    renderComProviders()
    await userEvent.click(screen.getByText('Ativar notificações'))

    expect(await screen.findByText('Notificações ativadas')).toBeInTheDocument()
    expect(screen.queryByText('Ativar notificações')).not.toBeInTheDocument()
  })

  it('permissao negada mostra a mensagem certa e mantem o botao', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(true)
    vi.mocked(pushLib.ativarNotificacoes).mockResolvedValue('negado')

    renderComProviders()
    await userEvent.click(screen.getByText('Ativar notificações'))

    expect(
      await screen.findByText('Permissão negada — ative nas configurações do navegador.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ativar notificações')).toBeInTheDocument()
  })

  it('chave vazia mostra mensagem de indisponivel', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(true)
    vi.mocked(pushLib.ativarNotificacoes).mockResolvedValue('indisponivel')

    renderComProviders()
    await userEvent.click(screen.getByText('Ativar notificações'))

    expect(await screen.findByText('Notificações indisponíveis neste ambiente.')).toBeInTheDocument()
  })

  it('erro inesperado mostra mensagem de erro e mantem o botao', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(true)
    vi.mocked(pushLib.ativarNotificacoes).mockRejectedValue(new Error('rede'))

    renderComProviders()
    await userEvent.click(screen.getByText('Ativar notificações'))

    expect(await screen.findByText('Não foi possível ativar notificações agora.')).toBeInTheDocument()
    expect(screen.getByText('Ativar notificações')).toBeInTheDocument()
  })

  it('nao mostra o botao de instalar quando nao ha prompt disponivel', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)

    renderComProviders()

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
  })

  it('mostra o botao de instalar quando o evento beforeinstallprompt ja disparou antes da montagem', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)

    renderComProviders()

    expect(screen.getByText('Instalar app')).toBeInTheDocument()
  })

  it('assina disponibilidade ao montar e cancela ao desmontar', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    const cancelar = vi.fn()
    vi.mocked(installPromptLib.assinarDisponibilidade).mockReturnValue(cancelar)

    const { unmount } = renderComProviders()
    expect(installPromptLib.assinarDisponibilidade).toHaveBeenCalledTimes(1)

    unmount()
    expect(cancelar).toHaveBeenCalledTimes(1)
  })

  it('clique com outcome "accepted" esconde o botao', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)
    vi.mocked(installPromptLib.solicitarInstalacao).mockResolvedValue('accepted')

    renderComProviders()
    await userEvent.click(screen.getByText('Instalar app'))

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
  })

  it('clique com outcome "dismissed" tambem esconde o botao, sem mensagem de erro', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)
    vi.mocked(installPromptLib.solicitarInstalacao).mockResolvedValue('dismissed')

    renderComProviders()
    await userEvent.click(screen.getByText('Instalar app'))

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
    expect(screen.queryByText(/não foi possível instalar/i)).not.toBeInTheDocument()
  })

  it('appinstalled disparado via assinatura esconde o botao', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)
    let notificar: () => void = () => {}
    vi.mocked(installPromptLib.assinarDisponibilidade).mockImplementation((callback) => {
      notificar = callback
      return () => {}
    })

    renderComProviders()
    expect(screen.getByText('Instalar app')).toBeInTheDocument()

    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(false)
    act(() => {
      notificar()
    })

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
  })
})
