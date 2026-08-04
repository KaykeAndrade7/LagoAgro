import { useEffect } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ApiError } from './api-client'

export function useMapeamentoErroFormulario<T extends FieldValues>(
  erro: ApiError | null | undefined,
  setError: UseFormSetError<T>,
  camposConhecidos: readonly Path<T>[],
): void {
  useEffect(() => {
    if (!erro) return
    const body = erro.body as Record<string, unknown> | null | undefined
    let algumCampoMapeado = false
    for (const campo of camposConhecidos) {
      const mensagens = body?.[campo]
      if (Array.isArray(mensagens) && typeof mensagens[0] === 'string') {
        setError(campo, { message: mensagens[0] })
        algumCampoMapeado = true
      }
    }
    if (!algumCampoMapeado) {
      const naoCampo = body?.non_field_errors
      const mensagemNaoCampo = Array.isArray(naoCampo) && typeof naoCampo[0] === 'string' ? naoCampo[0] : null
      const detail = typeof body?.detail === 'string' ? body.detail : (mensagemNaoCampo ?? erro.message)
      setError('root', { message: detail })
    }
  }, [erro, setError, camposConhecidos])
}
