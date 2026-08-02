import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Talhao } from '../api/talhoes'
import type { Cultura } from '../api/culturas'
import { ROTULOS_STATUS, type Plantio, type PlantioInput, type PlantioStatus } from '../api/plantios'

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
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      <div>
        <label htmlFor="plantio-talhao" className="block text-sm">
          Talhao
        </label>
        <select id="plantio-talhao" {...register('talhao')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {talhoes.map((talhao) => (
            <option key={talhao.id} value={talhao.id}>
              {talhao.nome}
            </option>
          ))}
        </select>
        {errors.talhao && <p className="text-sm text-red-600">{errors.talhao.message}</p>}
      </div>
      <div>
        <label htmlFor="plantio-cultura" className="block text-sm">
          Cultura
        </label>
        <select id="plantio-cultura" {...register('cultura')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {culturas.map((cultura) => (
            <option key={cultura.id} value={cultura.id}>
              {cultura.nome}
            </option>
          ))}
        </select>
        {errors.cultura && <p className="text-sm text-red-600">{errors.cultura.message}</p>}
      </div>
      <div>
        <label htmlFor="plantio-data" className="block text-sm">
          Data do plantio
        </label>
        <input id="plantio-data" type="date" {...register('data_plantio')} className="border px-2 py-1" />
        {errors.data_plantio && <p className="text-sm text-red-600">{errors.data_plantio.message}</p>}
      </div>
      <div>
        <label htmlFor="plantio-status" className="block text-sm">
          Status
        </label>
        <select id="plantio-status" {...register('status')} className="border px-2 py-1">
          {(Object.keys(ROTULOS_STATUS) as PlantioStatus[]).map((status) => (
            <option key={status} value={status}>
              {ROTULOS_STATUS[status]}
            </option>
          ))}
        </select>
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
