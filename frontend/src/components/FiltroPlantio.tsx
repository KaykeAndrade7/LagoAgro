import type { PlantioOpcao } from './AplicacaoInsumoForm'
import { Field, Select } from './ui'

type FiltroPlantioProps = {
  opcoes: PlantioOpcao[]
  value: number | null
  onChange: (id: number | null) => void
}

export function FiltroPlantio({ opcoes, value, onChange }: FiltroPlantioProps) {
  if (opcoes.length === 0) return null

  return (
    <Field id="filtro-plantio" label="Filtrar por plantio">
      <Select
        id="filtro-plantio"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">Todos os plantios</option>
        {opcoes.map((opcao) => (
          <option key={opcao.id} value={opcao.id}>
            {opcao.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}
