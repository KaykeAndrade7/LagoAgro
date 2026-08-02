import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Talhao, TalhaoInput } from '../api/talhoes'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  area: z
    .string()
    .min(1, 'Area e obrigatoria')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Area deve ser um numero maior que zero'),
  tipo_solo: z.string().min(1, 'Tipo de solo e obrigatorio'),
})

type TalhaoFormValues = z.infer<typeof schema>

type TalhaoFormProps = {
  propriedadeId: number
  talhao?: Talhao
  onSubmit: (input: TalhaoInput) => void
  onCancel: () => void
}

export function TalhaoForm({ propriedadeId, talhao, onSubmit, onCancel }: TalhaoFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TalhaoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: talhao?.nome ?? '',
      area: talhao?.area ?? '',
      tipo_solo: talhao?.tipo_solo ?? '',
    },
  })

  function aoSubmeter(values: TalhaoFormValues) {
    onSubmit({ propriedade: propriedadeId, ...values })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-2">
      <div>
        <label htmlFor="talhao-nome" className="block text-sm">
          Nome
        </label>
        <input id="talhao-nome" {...register('nome')} className="border px-2 py-1" />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome.message}</p>}
      </div>
      <div>
        <label htmlFor="talhao-area" className="block text-sm">
          Area (hectares)
        </label>
        <input id="talhao-area" {...register('area')} className="border px-2 py-1" />
        {errors.area && <p className="text-sm text-red-600">{errors.area.message}</p>}
      </div>
      <div>
        <label htmlFor="talhao-tipo-solo" className="block text-sm">
          Tipo de solo
        </label>
        <input id="talhao-tipo-solo" {...register('tipo_solo')} className="border px-2 py-1" />
        {errors.tipo_solo && <p className="text-sm text-red-600">{errors.tipo_solo.message}</p>}
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
