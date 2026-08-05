import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Talhao } from '../api/talhoes'
import type { Cultura } from '../api/culturas'
import { ROTULOS_STATUS, type Plantio, type PlantioInput, type PlantioStatus } from '../api/plantios'
import { Button, Field, Input, Select } from './ui'

const schema = z.object({
  talhao: z.coerce.number().min(1, 'Selecione um talhao'),
  cultura: z.coerce.number().min(1, 'Selecione uma cultura'),
  data_plantio: z.string().min(1, 'Data e obrigatoria'),
  status: z.enum(['em_andamento', 'colhido', 'cancelado']),
})

// z.coerce.number() faz o tipo de *input* do campo (antes da coercao) ser `unknown`,
// enquanto o tipo de *output* (depois da coercao) e `number`. O `Resolver` gerado pelo
// zodResolver espera o tipo de input como TFieldValues do form; se tiparmos useForm com
// o tipo de output (via z.infer, que e alias de z.output), o tsc reclama de incompatibilidade
// entre `unknown` e `number`. Por isso separamos os dois tipos e usamos a assinatura de
// 3 genericos do react-hook-form (TFieldValues, TContext, TTransformedValues).
type PlantioFormInput = z.input<typeof schema>
type PlantioFormValues = z.output<typeof schema>

type PlantioFormProps = {
  talhoes: Talhao[]
  culturas: Cultura[]
  plantio?: Plantio
  onSubmit: (input: PlantioInput) => void
  onCancel: () => void
}

export function PlantioForm({ talhoes, culturas, plantio, onSubmit, onCancel }: PlantioFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlantioFormInput, unknown, PlantioFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      talhao: plantio?.talhao ?? 0,
      cultura: plantio?.cultura ?? 0,
      data_plantio: plantio?.data_plantio ?? '',
      status: plantio?.status ?? 'em_andamento',
    },
  })

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-4">
      <Field id="plantio-talhao" label="Talhao" error={errors.talhao?.message}>
        <Select id="plantio-talhao" {...register('talhao')}>
          <option value={0}>Selecione...</option>
          {talhoes.map((talhao) => (
            <option key={talhao.id} value={talhao.id}>
              {talhao.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="plantio-cultura" label="Cultura" error={errors.cultura?.message}>
        <Select id="plantio-cultura" {...register('cultura')}>
          <option value={0}>Selecione...</option>
          {culturas.map((cultura) => (
            <option key={cultura.id} value={cultura.id}>
              {cultura.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="plantio-data" label="Data do plantio" error={errors.data_plantio?.message}>
        <Input id="plantio-data" type="date" {...register('data_plantio')} />
      </Field>
      <Field id="plantio-status" label="Status">
        <Select id="plantio-status" {...register('status')}>
          {(Object.keys(ROTULOS_STATUS) as PlantioStatus[]).map((status) => (
            <option key={status} value={status}>
              {ROTULOS_STATUS[status]}
            </option>
          ))}
        </Select>
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
