import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Talhao, TalhaoInput } from '../api/talhoes'
import { Button, Field, Input } from './ui'

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
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-4 py-2">
      <Field id="talhao-nome" label="Nome" error={errors.nome?.message}>
        <Input id="talhao-nome" {...register('nome')} />
      </Field>
      <Field id="talhao-area" label="Area (hectares)" error={errors.area?.message}>
        <Input id="talhao-area" inputMode="decimal" {...register('area')} />
      </Field>
      <Field id="talhao-tipo-solo" label="Tipo de solo" error={errors.tipo_solo?.message}>
        <Input id="talhao-tipo-solo" {...register('tipo_solo')} />
      </Field>
      <div className="flex gap-3">
        <Button type="submit">Salvar</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
