import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Propriedade, PropriedadeInput } from '../api/propriedades'
import { Button, Field, Input } from './ui'

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
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-4">
      <Field id="propriedade-nome" label="Nome" error={errors.nome?.message}>
        <Input id="propriedade-nome" {...register('nome')} />
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
