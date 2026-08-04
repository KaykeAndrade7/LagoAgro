import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Trabalhador, TrabalhadorInput } from '../api/trabalhadores'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  valor_diaria: z
    .string()
    .min(1, 'Valor da diaria e obrigatorio')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Valor da diaria deve ser um numero maior que zero'),
  ativo: z.boolean(),
})

type TrabalhadorFormValues = z.infer<typeof schema>

const CAMPOS_CONHECIDOS = ['nome', 'valor_diaria', 'ativo'] as const

type TrabalhadorFormProps = {
  trabalhador?: Trabalhador
  erro?: ApiError | null
  onSubmit: (input: TrabalhadorInput) => void
  onCancel: () => void
}

export function TrabalhadorForm({ trabalhador, erro, onSubmit, onCancel }: TrabalhadorFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TrabalhadorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: trabalhador?.nome ?? '',
      valor_diaria: trabalhador?.valor_diaria ?? '',
      ativo: trabalhador?.ativo ?? true,
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="trabalhador-nome" className="block text-sm">
          Nome
        </label>
        <input id="trabalhador-nome" {...register('nome')} className="border px-2 py-1" />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome.message}</p>}
      </div>
      <div>
        <label htmlFor="trabalhador-valor-diaria" className="block text-sm">
          Valor da diária
        </label>
        <input id="trabalhador-valor-diaria" {...register('valor_diaria')} className="border px-2 py-1" />
        {errors.valor_diaria && <p className="text-sm text-red-600">{errors.valor_diaria.message}</p>}
      </div>
      <div>
        <label htmlFor="trabalhador-ativo" className="flex items-center gap-2 text-sm">
          <input id="trabalhador-ativo" type="checkbox" {...register('ativo')} />
          Ativo
        </label>
        {errors.ativo && <p className="text-sm text-red-600">{errors.ativo.message}</p>}
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
