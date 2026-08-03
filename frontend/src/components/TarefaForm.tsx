import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Tarefa, TarefaInput } from '../api/tarefas'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  descricao: z.string().min(1, 'Descricao e obrigatoria'),
  data: z.string().min(1, 'Data e obrigatoria'),
})

// Mesmo problema de z.coerce.number() ja documentado em PlantioForm.tsx/AplicacaoInsumoForm.tsx:
// o tipo de *input* do campo 'plantio' e `unknown`, o de *output* e `number`. Separamos os dois
// tipos e usamos a assinatura de 3 genericos do react-hook-form.
type TarefaFormInput = z.input<typeof schema>
type TarefaFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'descricao', 'data'] as const

type TarefaFormProps = {
  plantioOpcoes: PlantioOpcao[]
  tarefa?: Tarefa
  erro?: ApiError | null
  onSubmit: (input: TarefaInput) => void
  onCancel: () => void
}

export function TarefaForm({ plantioOpcoes, tarefa, erro, onSubmit, onCancel }: TarefaFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TarefaFormInput, unknown, TarefaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantio: tarefa?.plantio ?? 0,
      descricao: tarefa?.descricao ?? '',
      data: tarefa?.data ?? '',
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="tarefa-plantio" className="block text-sm">
          Plantio
        </label>
        <select id="tarefa-plantio" {...register('plantio')} className="border px-2 py-1">
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
        <label htmlFor="tarefa-descricao" className="block text-sm">
          Descrição
        </label>
        <input id="tarefa-descricao" {...register('descricao')} className="border px-2 py-1" />
        {errors.descricao && <p className="text-sm text-red-600">{errors.descricao.message}</p>}
      </div>
      <div>
        <label htmlFor="tarefa-data" className="block text-sm">
          Data
        </label>
        <input id="tarefa-data" type="date" {...register('data')} className="border px-2 py-1" />
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
