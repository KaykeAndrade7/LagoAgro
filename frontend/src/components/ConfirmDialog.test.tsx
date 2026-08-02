import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('nao renderiza nada quando aberto e false', () => {
    const { container } = render(
      <ConfirmDialog aberto={false} titulo="t" mensagem="m" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra titulo e mensagem quando aberto e true', () => {
    render(
      <ConfirmDialog
        aberto={true}
        titulo="Excluir talhao"
        mensagem="Isso tambem excluira 2 plantio(s)."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Excluir talhao')).toBeInTheDocument()
    expect(screen.getByText('Isso tambem excluira 2 plantio(s).')).toBeInTheDocument()
  })

  it('confirmar dispara onConfirm e nao onCancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog aberto={true} titulo="t" mensagem="m" onConfirm={onConfirm} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Confirmar'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancelar dispara onCancel e nao onConfirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog aberto={true} titulo="t" mensagem="m" onConfirm={onConfirm} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
