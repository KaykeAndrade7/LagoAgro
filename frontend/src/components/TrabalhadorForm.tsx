import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Trabalhador, TrabalhadorInput } from '../api/trabalhadores'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Checkbox, Field, FormError, Input } from './ui'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  valor_diaria: z
    .string()
    .min(1, 'Valor da diaria e obrigatorio')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Valor da diaria deve ser um numero maior que zero'),
  ativo: z.boolean(),
})

type TrabalhadorFormValues = z.infer<typeof schema>

const CAMPOS_CONHECIDOS = ['nome', 'valor_diaria', 'ativo'] as const

type TrabalhadorFormProps = {
  trabalhador?: Trabalhador
  erro?: ApiError | null
  onSubmit: (input: TrabalhadorInput) => void
  onCancel: () => void
}

export function TrabalhadorForm({ trabalhador, erro, onSubmit, onCancel }: TrabalhadorFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TrabalhadorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: trabalhador?.nome ?? '',
      valor_diaria: trabalhador?.valor_diaria ?? '',
      ativo: trabalhador?.ativo ?? true,
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="trabalhador-nome" label="Nome" error={errors.nome?.message}>
        <Input id="trabalhador-nome" {...register('nome')} />
      </Field>
      <Field id="trabalhador-valor-diaria" label="Valor da diária" error={errors.valor_diaria?.message}>
        <Input id="trabalhador-valor-diaria" inputMode="decimal" {...register('valor_diaria')} />
      </Field>
      <Checkbox id="trabalhador-ativo" label="Ativo" {...register('ativo')} />
      <div className="flex gap-3">
        <Button type="submit">Salvar</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
