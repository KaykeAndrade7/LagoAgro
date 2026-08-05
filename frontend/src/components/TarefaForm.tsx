import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Tarefa, TarefaInput } from '../api/tarefas'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FormError, Input, Select } from './ui'

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
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="tarefa-plantio" label="Plantio" error={errors.plantio?.message}>
        <Select id="tarefa-plantio" {...register('plantio')}>
          <option value={0}>Selecione...</option>
          {plantioOpcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="tarefa-descricao" label="Descrição" error={errors.descricao?.message}>
        <Input id="tarefa-descricao" {...register('descricao')} />
      </Field>
      <Field id="tarefa-data" label="Data" error={errors.data?.message}>
        <Input id="tarefa-data" type="date" {...register('data')} />
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
