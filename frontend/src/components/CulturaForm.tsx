import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Cultura, CulturaInput } from '../api/culturas'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FieldLabel, FormError, IconPlus, IconTrash, Input } from './ui'

const numeroInteiroNaoNegativo = z
  .string()
  .min(1, 'Obrigatório')
  .refine((v) => !Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0, 'Deve ser um número inteiro maior ou igual a zero')

const faseSchema = z
  .object({
    nome: z.string().min(1, 'Nome da fase é obrigatório'),
    dia_inicio: numeroInteiroNaoNegativo,
    dia_fim: numeroInteiroNaoNegativo,
  })
  .refine((fase) => Number(fase.dia_inicio) < Number(fase.dia_fim), {
    message: 'dia_inicio deve ser menor que dia_fim',
    path: ['dia_fim'],
  })

const schema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  ciclo_dias: z
    .string()
    .min(1, 'Ciclo é obrigatório')
    .refine((v) => !Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) > 0, 'Ciclo deve ser um número inteiro maior que zero'),
  fases: z.array(faseSchema).min(1, 'Cadastre pelo menos uma fase'),
})

type CulturaFormValues = z.infer<typeof schema>

const CAMPOS_CONHECIDOS = ['nome', 'ciclo_dias', 'fases'] as const

type CulturaFormProps = {
  cultura?: Cultura
  erro?: ApiError | null
  onSubmit: (input: CulturaInput) => void
  onCancel: () => void
}

export function CulturaForm({ cultura, erro, onSubmit, onCancel }: CulturaFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CulturaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: cultura?.nome ?? '',
      ciclo_dias: cultura ? String(cultura.ciclo_dias) : '',
      fases: cultura
        ? cultura.fases.map((fase) => ({
            nome: fase.nome,
            dia_inicio: String(fase.dia_inicio),
            dia_fim: String(fase.dia_fim),
          }))
        : [{ nome: '', dia_inicio: '', dia_fim: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'fases' })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  function aoSubmeter(values: CulturaFormValues) {
    onSubmit({
      nome: values.nome,
      ciclo_dias: Number(values.ciclo_dias),
      fases: values.fases.map((fase) => ({
        nome: fase.nome,
        dia_inicio: Number(fase.dia_inicio),
        dia_fim: Number(fase.dia_fim),
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="cultura-nome" label="Nome" error={errors.nome?.message}>
        <Input id="cultura-nome" {...register('nome')} />
      </Field>
      <Field id="cultura-ciclo" label="Ciclo (dias)" error={errors.ciclo_dias?.message}>
        <Input id="cultura-ciclo" inputMode="numeric" {...register('ciclo_dias')} />
      </Field>

      <div className="space-y-3">
        <FieldLabel>Fases</FieldLabel>
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-wrap items-end gap-2">
            <Field id={`fase-${index}-nome`} label="Fase" error={errors.fases?.[index]?.nome?.message}>
              <Input id={`fase-${index}-nome`} {...register(`fases.${index}.nome` as const)} />
            </Field>
            <Field id={`fase-${index}-inicio`} label="Dia início" error={errors.fases?.[index]?.dia_inicio?.message}>
              <Input id={`fase-${index}-inicio`} inputMode="numeric" {...register(`fases.${index}.dia_inicio` as const)} />
            </Field>
            <Field id={`fase-${index}-fim`} label="Dia fim" error={errors.fases?.[index]?.dia_fim?.message}>
              <Input id={`fase-${index}-fim`} inputMode="numeric" {...register(`fases.${index}.dia_fim` as const)} />
            </Field>
            <Button type="button" variant="danger-ghost" size="sm" onClick={() => remove(index)}>
              <IconTrash className="h-4 w-4" /> Remover
            </Button>
          </div>
        ))}
        {errors.fases && (
          <FormError>{(errors.fases as any)?.message || 'Cadastre pelo menos uma fase'}</FormError>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ nome: '', dia_inicio: '', dia_fim: '' })}>
          <IconPlus className="h-4 w-4" /> Adicionar fase
        </Button>
      </div>

      <div className="flex gap-3">
        <Button type="submit">Salvar</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
