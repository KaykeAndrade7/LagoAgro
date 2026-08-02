import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Propriedade, PropriedadeInput } from '../api/propriedades'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
})

type PropriedadeFormProps = {
  propriedade?: Propriedade
  onSubmit: (input: PropriedadeInput) => void
  onCancel: () => void
}

export function PropriedadeForm({ propriedade, onSubmit, onCancel }: PropriedadeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropriedadeInput>({
    resolver: zodResolver(schema),
    defaultValues: { nome: propriedade?.nome ?? '' },
  })

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      <div>
        <label htmlFor="propriedade-nome" className="block text-sm">
          Nome
        </label>
        <input id="propriedade-nome" {...register('nome')} className="border px-2 py-1" />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome.message}</p>}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-green-700 px-3 py-1 text-sm text-white">
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
