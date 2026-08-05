import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Insumo } from '../api/insumos'
import type { AplicacaoInsumoInput } from '../api/aplicacoes'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FormError, Input, Select } from './ui'

export type PlantioOpcao = { id: number; label: string }

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  insumo: z.coerce.number().min(1, 'Selecione um insumo'),
  data: z.string().min(1, 'Data e obrigatoria'),
  quantidade: z
    .string()
    .min(1, 'Quantidade e obrigatoria')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Quantidade deve ser um numero maior que zero'),
})

// Mesmo problema de z.coerce.number() ja documentado em PlantioForm.tsx: o tipo de
// *input* do campo 'plantio'/'insumo' e `unknown`, o de *output* e `number`. Separamos
// os dois tipos e usamos a assinatura de 3 genericos do react-hook-form.
type AplicacaoInsumoFormInput = z.input<typeof schema>
type AplicacaoInsumoFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'insumo', 'data', 'quantidade'] as const

type AplicacaoInsumoFormProps = {
  plantioOpcoes: PlantioOpcao[]
  insumos: Insumo[]
  erro?: ApiError | null
  onSubmit: (input: AplicacaoInsumoInput) => void
  onCancel: () => void
}

export function AplicacaoInsumoForm({
  plantioOpcoes,
  insumos,
  erro,
  onSubmit,
  onCancel,
}: AplicacaoInsumoFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AplicacaoInsumoFormInput, unknown, AplicacaoInsumoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plantio: 0, insumo: 0, data: '', quantidade: '' },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="aplicacao-plantio" label="Plantio" error={errors.plantio?.message}>
        <Select id="aplicacao-plantio" {...register('plantio')}>
          <option value={0}>Selecione...</option>
          {plantioOpcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="aplicacao-insumo" label="Insumo" error={errors.insumo?.message}>
        <Select id="aplicacao-insumo" {...register('insumo')}>
          <option value={0}>Selecione...</option>
          {insumos.map((insumo) => (
            <option key={insumo.id} value={insumo.id}>
              {insumo.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="aplicacao-data" label="Data da aplicacao" error={errors.data?.message}>
        <Input id="aplicacao-data" type="date" {...register('data')} />
      </Field>
      <Field id="aplicacao-quantidade" label="Quantidade" error={errors.quantidade?.message}>
        <Input id="aplicacao-quantidade" inputMode="decimal" {...register('quantidade')} />
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
