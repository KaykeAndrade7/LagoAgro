import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Insumo, InsumoInput } from '../api/insumos'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FormError, Input, Select } from './ui'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  tipo: z.enum(['veneno', 'adubo']),
  carencia_dias: z
    .string()
    .min(1, 'Carencia e obrigatoria')
    .refine(
      (v) => !Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0,
      'Carencia deve ser um numero inteiro maior ou igual a zero',
    ),
})

type InsumoFormValues = z.infer<typeof schema>

const CAMPOS_CONHECIDOS = ['nome', 'tipo', 'carencia_dias'] as const

type InsumoFormProps = {
  insumo?: Insumo
  erro?: ApiError | null
  onSubmit: (input: InsumoInput) => void
  onCancel: () => void
}

export function InsumoForm({ insumo, erro, onSubmit, onCancel }: InsumoFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InsumoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: insumo?.nome ?? '',
      tipo: insumo?.tipo ?? 'veneno',
      carencia_dias: insumo ? String(insumo.carencia_dias) : '0',
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  function aoSubmeter(values: InsumoFormValues) {
    onSubmit({ nome: values.nome, tipo: values.tipo, carencia_dias: Number(values.carencia_dias) })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="insumo-nome" label="Nome" error={errors.nome?.message}>
        <Input id="insumo-nome" {...register('nome')} />
      </Field>
      <Field id="insumo-tipo" label="Tipo" error={errors.tipo?.message}>
        <Select id="insumo-tipo" {...register('tipo')}>
          <option value="veneno">Veneno</option>
          <option value="adubo">Adubo</option>
        </Select>
      </Field>
      <Field id="insumo-carencia" label="Carencia (dias)" error={errors.carencia_dias?.message}>
        <Input id="insumo-carencia" inputMode="numeric" {...register('carencia_dias')} />
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
