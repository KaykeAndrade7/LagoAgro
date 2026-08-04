import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Diaria, DiariaInput } from '../api/diarias'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

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
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="diaria-plantio" className="block text-sm">
          Plantio
        </label>
        <select id="diaria-plantio" {...register('plantio')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {plantioOpcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.label}
            </option>
          ))}
        </select>
        {errors.plantio && <p className="text-sm text-red-600">{errors.plantio.message}</p>}
      </div>
      <div>
        <label htmlFor="diaria-data" className="block text-sm">
          Data
        </label>
        <input id="diaria-data" type="date" {...register('data')} className="border px-2 py-1" />
        {errors.data && <p className="text-sm text-red-600">{errors.data.message}</p>}
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
