import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Insumo, InsumoInput } from '../api/insumos'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

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
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="insumo-nome" className="block text-sm">
          Nome
        </label>
        <input id="insumo-nome" {...register('nome')} className="border px-2 py-1" />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome.message}</p>}
      </div>
      <div>
        <label htmlFor="insumo-tipo" className="block text-sm">
          Tipo
        </label>
        <select id="insumo-tipo" {...register('tipo')} className="border px-2 py-1">
          <option value="veneno">Veneno</option>
          <option value="adubo">Adubo</option>
        </select>
        {errors.tipo && <p className="text-sm text-red-600">{errors.tipo.message}</p>}
      </div>
      <div>
        <label htmlFor="insumo-carencia" className="block text-sm">
          Carencia (dias)
        </label>
        <input id="insumo-carencia" {...register('carencia_dias')} className="border px-2 py-1" />
        {errors.carencia_dias && <p className="text-sm text-red-600">{errors.carencia_dias.message}</p>}
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
