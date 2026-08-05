import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { ROTULOS_CLASSIFICACAO, type Colheita, type ColheitaInput, type ClassificacaoColheita } from '../api/colheitas'
import { obterDataSeguraColheita } from '../api/plantios'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FormError, Input, Select } from './ui'

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  data: z.string().min(1, 'Data e obrigatoria'),
  classificacao: z.enum(['primeira', 'segunda']),
  quantidade: z
    .string()
    .min(1, 'Quantidade e obrigatoria')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Quantidade deve ser um numero maior que zero'),
})

// Mesmo problema de z.coerce.number() ja documentado em PlantioForm.tsx/TarefaForm.tsx:
// separamos o tipo de input (antes da coercao) do tipo de output (depois), e usamos a
// assinatura de 3 genericos do react-hook-form.
type ColheitaFormInput = z.input<typeof schema>
type ColheitaFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'data', 'classificacao', 'quantidade'] as const

type ColheitaFormProps = {
  plantioOpcoes: PlantioOpcao[]
  colheita?: Colheita
  erro?: ApiError | null
  onSubmit: (input: ColheitaInput) => void
  onCancel: () => void
}

export function ColheitaForm({ plantioOpcoes, colheita, erro, onSubmit, onCancel }: ColheitaFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<ColheitaFormInput, unknown, ColheitaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantio: colheita?.plantio ?? 0,
      data: colheita?.data ?? '',
      classificacao: colheita?.classificacao ?? 'primeira',
      quantidade: colheita?.quantidade ?? '',
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  const plantioSelecionado = Number(watch('plantio'))

  // Unico formulario do projeto que precisa de um dado que depende do valor
  // ao vivo de um dos seus proprios campos (a "data segura" e por-plantio) -
  // por isso, diferente de todo formulario anterior, este usa useQuery
  // diretamente aqui em vez de so receber props ja resolvidas pela pagina.
  const dataSeguraQuery = useQuery({
    queryKey: ['data-segura', plantioSelecionado],
    queryFn: () => obterDataSeguraColheita(plantioSelecionado),
    enabled: plantioSelecionado > 0,
  })

  function mensagemDataSegura(): string | null {
    if (!(plantioSelecionado > 0)) return null
    if (dataSeguraQuery.isError) return 'Não foi possível verificar a carência.'
    if (!dataSeguraQuery.isSuccess) return null
    const { data_segura } = dataSeguraQuery.data
    if (!data_segura) return 'Nenhuma restrição de carência para este plantio.'
    return `Data segura para colher: ${new Date(`${data_segura}T00:00:00`).toLocaleDateString('pt-BR')}`
  }

  const mensagem = mensagemDataSegura()

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="colheita-plantio" label="Plantio" error={errors.plantio?.message} hint={mensagem ?? undefined}>
        <Select id="colheita-plantio" {...register('plantio')}>
          <option value={0}>Selecione...</option>
          {plantioOpcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="colheita-data" label="Data" error={errors.data?.message}>
        <Input id="colheita-data" type="date" {...register('data')} />
      </Field>
      <Field id="colheita-classificacao" label="Classificação" error={errors.classificacao?.message}>
        <Select id="colheita-classificacao" {...register('classificacao')}>
          {(Object.keys(ROTULOS_CLASSIFICACAO) as ClassificacaoColheita[]).map((classificacao) => (
            <option key={classificacao} value={classificacao}>
              {ROTULOS_CLASSIFICACAO[classificacao]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="colheita-quantidade" label="Quantidade (caixas)" error={errors.quantidade?.message}>
        <Input id="colheita-quantidade" inputMode="numeric" {...register('quantidade')} />
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
