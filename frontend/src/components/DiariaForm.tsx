import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Diaria, DiariaInput } from '../api/diarias'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FormError, Input, Select } from './ui'

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  data: z.string().min(1, 'Data e obrigatoria'),
})

// Mesmo problema de z.coerce.number() ja documentado em PlantioForm.tsx/TarefaForm.tsx.
type DiariaFormInput = z.input<typeof schema>
type DiariaFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'data'] as const

type DiariaFormProps = {
  trabalhadorId: number
  plantioOpcoes: PlantioOpcao[]
  diaria?: Diaria
  erro?: ApiError | null
  onSubmit: (input: DiariaInput) => void
  onCancel: () => void
}

export function DiariaForm({ trabalhadorId, plantioOpcoes, diaria, erro, onSubmit, onCancel }: DiariaFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DiariaFormInput, unknown, DiariaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantio: diaria?.plantio ?? 0,
      data: diaria?.data ?? '',
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  function aoSubmeter(values: DiariaFormValues) {
    onSubmit({ trabalhador: trabalhadorId, plantio: values.plantio, data: values.data })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-4 py-2">
      <FormError>{errors.root?.message}</FormError>
      <Field id="diaria-plantio" label="Plantio" error={errors.plantio?.message}>
        <Select id="diaria-plantio" {...register('plantio')}>
          <option value={0}>Selecione...</option>
          {plantioOpcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="diaria-data" label="Data" error={errors.data?.message}>
        <Input id="diaria-data" type="date" {...register('data')} />
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
