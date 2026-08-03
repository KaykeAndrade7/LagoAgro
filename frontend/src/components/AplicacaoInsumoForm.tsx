import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Insumo } from '../api/insumos'
import type { AplicacaoInsumoInput } from '../api/aplicacoes'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

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
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="aplicacao-plantio" className="block text-sm">
          Plantio
        </label>
        <select id="aplicacao-plantio" {...register('plantio')} className="border px-2 py-1">
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
        <label htmlFor="aplicacao-insumo" className="block text-sm">
          Insumo
        </label>
        <select id="aplicacao-insumo" {...register('insumo')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {insumos.map((insumo) => (
            <option key={insumo.id} value={insumo.id}>
              {insumo.nome}
            </option>
          ))}
        </select>
        {errors.insumo && <p className="text-sm text-red-600">{errors.insumo.message}</p>}
      </div>
      <div>
        <label htmlFor="aplicacao-data" className="block text-sm">
          Data da aplicacao
        </label>
        <input id="aplicacao-data" type="date" {...register('data')} className="border px-2 py-1" />
        {errors.data && <p className="text-sm text-red-600">{errors.data.message}</p>}
      </div>
      <div>
        <label htmlFor="aplicacao-quantidade" className="block text-sm">
          Quantidade
        </label>
        <input id="aplicacao-quantidade" {...register('quantidade')} className="border px-2 py-1" />
        {errors.quantidade && <p className="text-sm text-red-600">{errors.quantidade.message}</p>}
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
