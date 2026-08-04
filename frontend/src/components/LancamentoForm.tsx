import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ROTULOS_SETOR,
  type LancamentoFinanceiro,
  type LancamentoFinanceiroInput,
  type SetorLancamento,
} from '../api/lancamentos'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  valor: z
    .string()
    .min(1, 'Valor e obrigatorio')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Valor deve ser um numero maior que zero'),
  data: z.string().min(1, 'Data e obrigatoria'),
  descricao: z.string().min(1, 'Descricao e obrigatoria'),
  setor: z.enum(['mao_de_obra', 'insumos', 'maquinario', 'transporte', 'manutencao', 'outros']),
})

type LancamentoFormInput = z.input<typeof schema>
type LancamentoFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'valor', 'data', 'descricao', 'setor'] as const

type LancamentoFormProps = {
  plantioOpcoes: PlantioOpcao[]
  lancamento?: LancamentoFinanceiro
  erro?: ApiError | null
  onSubmit: (input: LancamentoFinanceiroInput) => void
  onCancel: () => void
}

export function LancamentoForm({ plantioOpcoes, lancamento, erro, onSubmit, onCancel }: LancamentoFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LancamentoFormInput, unknown, LancamentoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantio: lancamento?.plantio ?? 0,
      valor: lancamento?.valor ?? '',
      data: lancamento?.data ?? '',
      descricao: lancamento?.descricao ?? '',
      setor: lancamento?.setor ?? 'outros',
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="lancamento-plantio" className="block text-sm">
          Plantio
        </label>
        <select id="lancamento-plantio" {...register('plantio')} className="border px-2 py-1">
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
        <label htmlFor="lancamento-valor" className="block text-sm">
          Valor
        </label>
        <input id="lancamento-valor" {...register('valor')} className="border px-2 py-1" />
        {errors.valor && <p className="text-sm text-red-600">{errors.valor.message}</p>}
      </div>
      <div>
        <label htmlFor="lancamento-data" className="block text-sm">
          Data
        </label>
        <input id="lancamento-data" type="date" {...register('data')} className="border px-2 py-1" />
        {errors.data && <p className="text-sm text-red-600">{errors.data.message}</p>}
      </div>
      <div>
        <label htmlFor="lancamento-descricao" className="block text-sm">
          Descrição
        </label>
        <input id="lancamento-descricao" {...register('descricao')} className="border px-2 py-1" />
        {errors.descricao && <p className="text-sm text-red-600">{errors.descricao.message}</p>}
      </div>
      <div>
        <label htmlFor="lancamento-setor" className="block text-sm">
          Setor
        </label>
        <select id="lancamento-setor" {...register('setor')} className="border px-2 py-1">
          {(Object.keys(ROTULOS_SETOR) as SetorLancamento[]).map((setor) => (
            <option key={setor} value={setor}>
              {ROTULOS_SETOR[setor]}
            </option>
          ))}
        </select>
        {errors.setor && <p className="text-sm text-red-600">{errors.setor.message}</p>}
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
