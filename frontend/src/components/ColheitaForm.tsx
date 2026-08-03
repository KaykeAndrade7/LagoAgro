import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { ROTULOS_CLASSIFICACAO, type Colheita, type ColheitaInput, type ClassificacaoColheita } from '../api/colheitas'
import { obterDataSeguraColheita } from '../api/plantios'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

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
    if (!(plantioSelecionado > 0) || !dataSeguraQuery.isSuccess) return null
    const { data_segura } = dataSeguraQuery.data
    if (!data_segura) return 'Nenhuma restrição de carência para este plantio.'
    return `Data segura para colher: ${new Date(`${data_segura}T00:00:00`).toLocaleDateString('pt-BR')}`
  }

  const mensagem = mensagemDataSegura()

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="colheita-plantio" className="block text-sm">
          Plantio
        </label>
        <select id="colheita-plantio" {...register('plantio')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {plantioOpcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.label}
            </option>
          ))}
        </select>
        {errors.plantio && <p className="text-sm text-red-600">{errors.plantio.message}</p>}
      </div>
      {mensagem && <p className="text-sm text-gray-600">{mensagem}</p>}
      <div>
        <label htmlFor="colheita-data" className="block text-sm">
          Data
        </label>
        <input id="colheita-data" type="date" {...register('data')} className="border px-2 py-1" />
        {errors.data && <p className="text-sm text-red-600">{errors.data.message}</p>}
      </div>
      <div>
        <label htmlFor="colheita-classificacao" className="block text-sm">
          Classificação
        </label>
        <select id="colheita-classificacao" {...register('classificacao')} className="border px-2 py-1">
          {(Object.keys(ROTULOS_CLASSIFICACAO) as ClassificacaoColheita[]).map((classificacao) => (
            <option key={classificacao} value={classificacao}>
              {ROTULOS_CLASSIFICACAO[classificacao]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="colheita-quantidade" className="block text-sm">
          Quantidade (caixas)
        </label>
        <input id="colheita-quantidade" {...register('quantidade')} className="border px-2 py-1" />
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
