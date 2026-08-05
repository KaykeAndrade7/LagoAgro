import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ROTULOS_SETOR,
  ROTULOS_TIPO,
  SETORES_POR_TIPO,
  type LancamentoFinanceiro,
  type LancamentoFinanceiroInput,
  type TipoLancamento,
} from '../api/lancamentos'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FormError, Input, Select } from './ui'

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  tipo: z.enum(['gasto', 'ganho']),
  valor: z
    .string()
    .min(1, 'Valor e obrigatorio')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Valor deve ser um numero maior que zero'),
  data: z.string().min(1, 'Data e obrigatoria'),
  descricao: z.string().min(1, 'Descricao e obrigatoria'),
  setor: z.enum(['mao_de_obra', 'insumos', 'maquinario', 'transporte', 'manutencao', 'venda_colheita', 'outros']),
})

type LancamentoFormInput = z.input<typeof schema>
type LancamentoFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'tipo', 'valor', 'data', 'descricao', 'setor'] as const

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
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LancamentoFormInput, unknown, LancamentoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantio: lancamento?.plantio ?? 0,
      tipo: lancamento?.tipo ?? 'gasto',
      valor: lancamento?.valor ?? '',
      data: lancamento?.data ?? '',
      descricao: lancamento?.descricao ?? '',
      setor: lancamento?.setor ?? 'outros',
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  const tipoValue = watch('tipo')
  const tipoSelecionado: TipoLancamento = (tipoValue === 'ganho' ? 'ganho' : 'gasto')
  const setoresValidos = SETORES_POR_TIPO[tipoSelecionado]

  // Guarda o tipo do render anterior pra distinguir "tipo mudou porque o
  // usuario trocou o select" de "tipo veio assim no mount via defaultValues"
  // (ex.: abrindo o formulario de edicao com tipo=ganho). So reseta o setor
  // no primeiro caso - no segundo, o setor carregado do lancamento existente
  // deve ser preservado tal como esta salvo.
  const tipoAnteriorRef = useRef(tipoSelecionado)

  // Trocar de tipo (pela mao do usuario) sempre reseta pro primeiro setor
  // valido do tipo novo - inclusive quando o setor atual "outros" ja seria
  // tecnicamente valido nos dois tipos, pra Venda de colheita nao exigir um
  // clique extra so porque coincide de outros ser valido nos dois.
  useEffect(() => {
    if (tipoAnteriorRef.current !== tipoSelecionado) {
      tipoAnteriorRef.current = tipoSelecionado
      setValue('setor', setoresValidos[0])
    }
  }, [tipoSelecionado, setoresValidos, setValue])

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="lancamento-plantio" label="Plantio" error={errors.plantio?.message}>
        <Select id="lancamento-plantio" {...register('plantio')}>
          <option value={0}>Selecione...</option>
          {plantioOpcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="lancamento-tipo" label="Tipo" error={errors.tipo?.message}>
        <Select id="lancamento-tipo" {...register('tipo')}>
          {(Object.keys(ROTULOS_TIPO) as TipoLancamento[]).map((tipo) => (
            <option key={tipo} value={tipo}>
              {ROTULOS_TIPO[tipo]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="lancamento-valor" label="Valor" error={errors.valor?.message}>
        <Input id="lancamento-valor" inputMode="decimal" {...register('valor')} />
      </Field>
      <Field id="lancamento-data" label="Data" error={errors.data?.message}>
        <Input id="lancamento-data" type="date" {...register('data')} />
      </Field>
      <Field id="lancamento-descricao" label="Descrição" error={errors.descricao?.message}>
        <Input id="lancamento-descricao" {...register('descricao')} />
      </Field>
      <Field id="lancamento-setor" label="Setor" error={errors.setor?.message}>
        <Select id="lancamento-setor" {...register('setor')}>
          {setoresValidos.map((setor) => (
            <option key={setor} value={setor}>
              {ROTULOS_SETOR[setor]}
            </option>
          ))}
        </Select>
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
