import { Button, Card } from './ui'

type ConfirmDialogProps = {
  aberto: boolean
  titulo: string
  mensagem: string
  erro?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ aberto, titulo, mensagem, erro, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!aberto) return null

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-titulo" className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 px-4">
      <Card className="w-full max-w-sm p-6">
        <h2 id="confirm-dialog-titulo" className="mb-2 font-display text-lg font-black uppercase tracking-tight text-ink">
          {titulo}
        </h2>
        <p className="mb-5 font-display font-semibold text-ink-soft">{mensagem}</p>
        {erro && (
          <p role="alert" className="mb-5 rounded-md border-2 border-rust/30 bg-rust-bg px-3 py-2 text-sm font-bold text-rust">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </Card>
    </div>
  )
}
