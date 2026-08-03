import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import * as pushLib from '../lib/push'
import * as authContext from '../auth/AuthContext'

vi.mock('../lib/push')
vi.mock('../auth/AuthContext')

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
})
