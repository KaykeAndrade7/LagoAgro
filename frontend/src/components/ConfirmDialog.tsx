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
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="max-w-sm rounded bg-white p-6">
        <h2 className="mb-2 text-lg font-bold">{titulo}</h2>
        <p className="mb-4 text-sm">{mensagem}</p>
        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border px-3 py-1 text-sm">
            Cancelar
          </button>
          <button onClick={onConfirm} className="rounded bg-red-600 px-3 py-1 text-sm text-white">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
