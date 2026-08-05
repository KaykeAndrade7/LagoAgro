# Financeiro: separar gastos e ganhos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar `LancamentoFinanceiro` em gastos e ganhos (campo `tipo`), com "Venda de colheita" como categoria de ganho, filtro Todos/Gastos/Ganhos e três totais (gasto, ganho, saldo líquido) na `FinanceiroPage`.

**Architecture:** Um campo `tipo` novo no model `LancamentoFinanceiro` existente (não um model novo) — mesma forma pros dois tipos, só a lista de categorias (`setor`) válidas muda. Backend valida a combinação tipo×setor no serializer. Frontend filtra as opções de categoria mostradas conforme o tipo selecionado no formulário, e calcula os três totais na página a partir de todos os lançamentos (independente do filtro de exibição ativo).

**Tech Stack:** Django + DRF (backend), React + TypeScript + react-hook-form + zod + TanStack Query (frontend) — mesma stack já em uso no projeto, sem dependência nova.

## Global Constraints

- Toda mudança de backend roda `uv run pytest tests/test_finance_views.py -v` a partir de `lagoagro/` antes de qualquer commit.
- Toda mudança de frontend roda `npx tsc -b --noEmit` a partir de `frontend/` — projeto inteiro, não só os arquivos tocados — antes de qualquer commit (regra já estabelecida no projeto: `vitest` não é type-checker).
- Commits seguem Conventional Commits, escopo `finance` (backend) ou `frontend`, um commit por task.
- `Ganho` é só venda de colheita nesta spec — nenhuma outra categoria de receita é adicionada agora (fora de escopo, ver spec).

---

### Task 1: Backend — campo `tipo`, categoria de venda e validação tipo×setor

**Files:**
- Modify: `lagoagro/finance/models.py`
- Create: `lagoagro/finance/migrations/0006_lancamentofinanceiro_tipo.py` (via `makemigrations`, não escrito à mão)
- Modify: `lagoagro/finance/serializers.py`
- Modify: `lagoagro/tests/test_finance_views.py`

**Interfaces:**
- Produces: `LancamentoFinanceiro.tipo` (`"gasto"|"ganho"`, default `"gasto"`), `LancamentoFinanceiro.GASTO_SETORES`/`GANHO_SETORES` (sets de strings, atributos de classe), `LancamentoFinanceiroSerializer` aceitando/retornando `tipo`, rejeitando com 400 uma combinação `tipo`×`setor` inválida.

- [ ] **Step 1: Modificar `finance/models.py` — adicionar `tipo`, nova categoria e os dois conjuntos de setores válidos**

Substituir a classe `LancamentoFinanceiro` inteira por:

```python
class LancamentoFinanceiro(models.Model):
    TIPO_CHOICES = [
        ("gasto", "Gasto"),
        ("ganho", "Ganho"),
    ]

    # Lista generica de setores (aprovada com o usuario) - cobre mao de obra
    # separadamente dos demais custos, sem precisar de um catalogo a parte.
    # "venda_colheita" e "outros" tambem servem pra tipo="ganho" - ver
    # GASTO_SETORES/GANHO_SETORES abaixo pra quais sao validos em cada tipo.
    SETOR_CHOICES = [
        ("mao_de_obra", "Mão de obra"),
        ("insumos", "Insumos"),
        ("maquinario", "Maquinário/equipamentos"),
        ("transporte", "Transporte/frete"),
        ("manutencao", "Manutenção/infraestrutura"),
        ("venda_colheita", "Venda de colheita"),
        ("outros", "Outros"),
    ]

    GASTO_SETORES = {"mao_de_obra", "insumos", "maquinario", "transporte", "manutencao", "outros"}
    GANHO_SETORES = {"venda_colheita", "outros"}

    # plantio e PROTECT (ADR 008): lancamento e trilha financeira e nao pode
    # sumir junto com o plantio (usar Plantio.status="cancelado" em vez de deletar).
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.PROTECT, related_name="lancamentos")
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default="gasto")
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    descricao = models.CharField(max_length=255)
    setor = models.CharField(max_length=20, choices=SETOR_CHOICES)

    def __str__(self):
        return f"{self.descricao}: {self.valor} ({self.data})"
```

- [ ] **Step 2: Gerar a migração**

Run (a partir de `lagoagro/`): `uv run python manage.py makemigrations finance`

Expected: cria `finance/migrations/0006_lancamentofinanceiro_tipo.py` (um `AddField` com `default="gasto"` — o Django gera esse arquivo sozinho a partir da mudança do model, não precisa editar).

- [ ] **Step 3: Rodar a migração local pra confirmar que aplica sem erro**

Run: `uv run python manage.py migrate finance`
Expected: `Applying finance.0006_lancamentofinanceiro_tipo... OK`

- [ ] **Step 4: Modificar `finance/serializers.py` — adicionar `tipo` e a validação cruzada**

Substituir a classe `LancamentoFinanceiroSerializer` inteira por:

```python
class LancamentoFinanceiroSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = LancamentoFinanceiro
        fields = ["id", "plantio", "tipo", "valor", "data", "descricao", "setor"]
        extra_kwargs = {"tipo": {"required": True}}

    def validate(self, attrs):
        # PATCH parcial pode nao mandar tipo/setor - cai no valor atual da
        # instancia. Create sempre manda os dois (tipo e obrigatorio, setor
        # ja era obrigatorio antes desta mudanca).
        if self.instance is not None:
            tipo = attrs.get("tipo", self.instance.tipo)
            setor = attrs.get("setor", self.instance.setor)
        else:
            tipo = attrs.get("tipo", "gasto")
            setor = attrs.get("setor")

        setores_validos = LancamentoFinanceiro.GANHO_SETORES if tipo == "ganho" else LancamentoFinanceiro.GASTO_SETORES
        if setor is not None and setor not in setores_validos:
            raise serializers.ValidationError(f"Setor '{setor}' não é válido para o tipo '{tipo}'.")
        return attrs
```

(`LancamentoFinanceiro` já está importado no topo do arquivo — `from .models import Diaria, LancamentoFinanceiro, Trabalhador`, não precisa adicionar import novo.)

- [ ] **Step 5: Atualizar os 2 testes existentes que fazem POST direto em `/api/lancamentos-financeiros/`**

Em `tests/test_finance_views.py`, `tipo` agora é obrigatório no POST — os dois testes abaixo (linhas ~21-29 e ~32-39 no arquivo atual) precisam do campo `"tipo": "gasto"` no corpo da requisição:

```python
def test_criar_lancamento_com_plantio_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio.id, "tipo": "gasto", "valor": "150.00", "data": "2026-01-15", "descricao": "Compra de mudas", "setor": "insumos",
    })

    assert response.status_code == 201


def test_criar_lancamento_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio_outro.id, "tipo": "gasto", "valor": "150.00", "data": "2026-01-15", "descricao": "Compra de mudas", "setor": "insumos",
    })

    assert response.status_code == 400
```

Os outros testes de `LancamentoFinanceiro` (`test_listar_lancamentos_so_retorna_do_usuario_autenticado`,
`test_acessar_lancamento_de_outro_usuario_retorna_404`) usam
`LancamentoFinanceiro.objects.create(...)` direto no ORM, não passam pelo
serializer — **não precisam de mudança** (o `default="gasto"` do model
cobre esses casos).

- [ ] **Step 6: Adicionar os 3 testes novos de validação tipo×setor**

Adicionar ao final da seção `# --- LancamentoFinanceiro ---` em `tests/test_finance_views.py` (antes da seção `# --- Trabalhador ---`):

```python
def test_criar_lancamento_gasto_com_setor_de_ganho_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio.id, "tipo": "gasto", "valor": "150.00", "data": "2026-01-15",
        "descricao": "Venda equivocada", "setor": "venda_colheita",
    })

    assert response.status_code == 400


def test_criar_lancamento_ganho_com_setor_de_gasto_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio.id, "tipo": "ganho", "valor": "500.00", "data": "2026-01-15",
        "descricao": "Venda de tomate", "setor": "insumos",
    })

    assert response.status_code == 400


def test_criar_lancamento_ganho_com_setor_venda_colheita_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio.id, "tipo": "ganho", "valor": "500.00", "data": "2026-01-15",
        "descricao": "Venda de tomate", "setor": "venda_colheita",
    })

    assert response.status_code == 201
    assert response.data["tipo"] == "ganho"
```

- [ ] **Step 7: Rodar a suíte de finance e confirmar que tudo passa**

Run (a partir de `lagoagro/`): `uv run pytest tests/test_finance_views.py -v`
Expected: todos os testes passam (os 2 atualizados no Step 5 + os 3 novos do Step 6 + todos os que já existiam sem mudança).

- [ ] **Step 8: Rodar a suíte completa do backend (garantir que nada mais quebrou)**

Run: `uv run pytest -q`
Expected: todos os testes passam (163 + 3 novos = 166).

- [ ] **Step 9: Commit**

```bash
git add lagoagro/finance/models.py lagoagro/finance/migrations/0006_lancamentofinanceiro_tipo.py lagoagro/finance/serializers.py lagoagro/tests/test_finance_views.py
git commit -m "feat(finance): adicionar tipo (gasto/ganho) e categoria venda_colheita"
```

---

### Task 2: Backend — `pagar_diarias_pendentes` sempre gera lançamento tipo `gasto`

**Files:**
- Modify: `lagoagro/finance/services.py`
- Modify: `lagoagro/tests/test_finance_views.py`

**Interfaces:**
- Consumes: `LancamentoFinanceiro.tipo` (Task 1).
- Produces: nada novo pra outras tasks consumirem — mudança de comportamento interna, coberta por teste.

- [ ] **Step 1: Modificar `finance/services.py` — setar `tipo="gasto"` explicitamente na criação**

Em `pagar_diarias_pendentes`, dentro do `for plantio_id in plantio_ids_pendentes:`, o `LancamentoFinanceiro.objects.create(...)` passa a incluir `tipo`:

```python
        lancamento = LancamentoFinanceiro.objects.create(
            plantio_id=plantio_id,
            tipo="gasto",
            valor=agregado["total"],
            data=timezone.localdate(),
            descricao=(
                f"Pagamento de diárias - {trabalhador.nome} "
                f"({agregado['inicio']:%d/%m/%Y} a {agregado['fim']:%d/%m/%Y})"
            ),
            setor="mao_de_obra",
        )
```

(Só a linha `tipo="gasto",` é nova; o resto da função não muda.)

- [ ] **Step 2: Adicionar a asserção de `tipo` no teste da ação `pagar-diarias`**

Em `tests/test_finance_views.py`, no teste `test_pagar_diarias_pendentes_via_action_cria_lancamento` (seção `# --- pagar-diarias action ---`), adicionar uma linha à lista de asserções existente:

```python
def test_pagar_diarias_pendentes_via_action_cria_lancamento(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-02")

    response = client.post(f"/api/trabalhadores/{trabalhador.id}/pagar-diarias/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["valor"] == "240.00"
    assert response.data[0]["tipo"] == "gasto"
    assert LancamentoFinanceiro.objects.count() == 1
```

- [ ] **Step 3: Rodar a suíte de finance**

Run: `uv run pytest tests/test_finance_views.py -v`
Expected: todos passam, incluindo a asserção nova.

- [ ] **Step 4: Rodar a suíte completa do backend**

Run: `uv run pytest -q`
Expected: 166 testes passam.

- [ ] **Step 5: Commit**

```bash
git add lagoagro/finance/services.py lagoagro/tests/test_finance_views.py
git commit -m "fix(finance): marcar lancamento de pagar-diarias com tipo=gasto explicitamente"
```

---

### Task 3: Frontend — tipo em `api/lancamentos.ts` e `LancamentoForm`

**Files:**
- Modify: `frontend/src/api/lancamentos.ts`
- Modify: `frontend/src/components/LancamentoForm.tsx`
- Modify: `frontend/src/components/LancamentoForm.test.tsx`
- Modify: `frontend/src/pages/FinanceiroPage.test.tsx` (só ajuste mecânico de fixtures pra compilar — comportamento novo da página é a Task 4)

**Interfaces:**
- Consumes: nada de outra task frontend.
- Produces: `TipoLancamento` (`'gasto'|'ganho'`), `ROTULOS_TIPO`, `SETORES_POR_TIPO: Record<TipoLancamento, SetorLancamento[]>`, `LancamentoFinanceiro`/`LancamentoFinanceiroInput` com campo `tipo` obrigatório — Task 4 consome todos esses.

- [ ] **Step 1: Reescrever `api/lancamentos.ts` inteiro**

```typescript
import { apiRequest } from '../lib/api-client'

export type TipoLancamento = 'gasto' | 'ganho'

export type SetorLancamento =
  | 'mao_de_obra'
  | 'insumos'
  | 'maquinario'
  | 'transporte'
  | 'manutencao'
  | 'venda_colheita'
  | 'outros'

export type LancamentoFinanceiro = {
  id: number
  plantio: number
  tipo: TipoLancamento
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export type LancamentoFinanceiroInput = {
  plantio: number
  tipo: TipoLancamento
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export const ROTULOS_TIPO: Record<TipoLancamento, string> = {
  gasto: 'Gasto',
  ganho: 'Ganho',
}

export const ROTULOS_SETOR: Record<SetorLancamento, string> = {
  mao_de_obra: 'Mão de obra',
  insumos: 'Insumos',
  maquinario: 'Maquinário/equipamentos',
  transporte: 'Transporte/frete',
  manutencao: 'Manutenção/infraestrutura',
  venda_colheita: 'Venda de colheita',
  outros: 'Outros',
}

export const SETORES_POR_TIPO: Record<TipoLancamento, SetorLancamento[]> = {
  gasto: ['mao_de_obra', 'insumos', 'maquinario', 'transporte', 'manutencao', 'outros'],
  ganho: ['venda_colheita', 'outros'],
}

export function listarLancamentos(): Promise<LancamentoFinanceiro[]> {
  return apiRequest<LancamentoFinanceiro[]>('/lancamentos-financeiros/')
}

export function criarLancamento(input: LancamentoFinanceiroInput): Promise<LancamentoFinanceiro> {
  return apiRequest<LancamentoFinanceiro>('/lancamentos-financeiros/', { method: 'POST', body: input })
}

export function atualizarLancamento(id: number, input: LancamentoFinanceiroInput): Promise<LancamentoFinanceiro> {
  return apiRequest<LancamentoFinanceiro>(`/lancamentos-financeiros/${id}/`, { method: 'PATCH', body: input })
}

export function excluirLancamento(id: number): Promise<void> {
  return apiRequest<void>(`/lancamentos-financeiros/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 2: Reescrever `LancamentoForm.tsx` inteiro**

```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ROTULOS_SETOR,
  ROTULOS_TIPO,
  SETORES_POR_TIPO,
  type LancamentoFinanceiro,
  type LancamentoFinanceiroInput,
  type SetorLancamento,
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

  const tipoSelecionado = watch('tipo') as TipoLancamento
  const setorSelecionado = watch('setor') as SetorLancamento
  const setoresValidos = SETORES_POR_TIPO[tipoSelecionado]

  // Trocar de tipo com uma categoria que nao existe mais no novo tipo
  // (ex.: "Insumos" ao trocar de Gasto pra Ganho) reseta pro primeiro
  // setor valido do tipo novo - evita submeter uma combinacao invalida
  // por inercia da UI (o backend rejeitaria com 400 de qualquer forma).
  useEffect(() => {
    if (!setoresValidos.includes(setorSelecionado)) {
      setValue('setor', setoresValidos[0])
    }
  }, [tipoSelecionado, setorSelecionado, setoresValidos, setValue])

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
```

- [ ] **Step 3: Reescrever `LancamentoForm.test.tsx` inteiro**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LancamentoForm } from './LancamentoForm'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

describe('LancamentoForm', () => {
  it('popula os selects de plantio, tipo e setor a partir das props', () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Gasto' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ganho' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mão de obra' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Insumos' })).toBeInTheDocument()
  })

  it('tipo Gasto e o padrao ao criar', () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Tipo')).toHaveValue('gasto')
  })

  it('trocar tipo pra ganho mostra as categorias de ganho e esconde as de gasto', async () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'ganho')

    expect(screen.getByRole('option', { name: 'Venda de colheita' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Insumos' })).not.toBeInTheDocument()
  })

  it('trocar de tipo com uma categoria que nao existe mais no novo tipo reseta pra uma valida', async () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Setor'), 'insumos')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'ganho')

    expect(screen.getByLabelText('Setor')).toHaveValue('venda_colheita')
  })

  it('chama onSubmit com os valores preenchidos', async () => {
    const onSubmit = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Valor'), '150.00')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.selectOptions(screen.getByLabelText('Setor'), 'insumos')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      plantio: 1,
      tipo: 'gasto',
      valor: '150.00',
      data: '2026-08-05',
      descricao: 'Compra de mudas',
      setor: 'insumos',
    })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Valor'), '150.00')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando valor nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Valor'), 'abc')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Valor deve ser um numero maior que zero')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um lancamento existente', () => {
    const lancamento = {
      id: 1,
      plantio: 1,
      tipo: 'ganho' as const,
      valor: '400.00',
      data: '2026-08-05',
      descricao: 'Venda de tomate',
      setor: 'venda_colheita' as const,
    }
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} lancamento={lancamento} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Tipo')).toHaveValue('ganho')
    expect(screen.getByLabelText('Valor')).toHaveValue('400.00')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Venda de tomate')
    expect(screen.getByLabelText('Setor')).toHaveValue('venda_colheita')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { descricao: ['Descricao muito longa.'] })
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Descricao muito longa.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Ajustar as fixtures de `FinanceiroPage.test.tsx` só pra compilar (sem novo comportamento ainda)**

`LancamentoFinanceiro` agora exige `tipo` — adicionar `tipo: 'gasto',` em toda fixture literal existente no arquivo. Sem mudar nenhuma asserção, sem adicionar teste novo (isso é a Task 4). São 5 objetos literais a ajustar:

1. No teste `'lista carrega e mostra o total geral'`, os 2 objetos do array passado a `mockResolvedValue`.
2. No teste `'criar lancamento via formulario adiciona o item a lista'`, o objeto de `mockResolvedValueOnce` (segundo array) e o objeto passado a `criarLancamento.mockResolvedValue`.
3. No teste `'excluir lancamento sem diarias vinculadas nao mostra aviso de uso'`, o objeto do array.
4. No teste `'excluir lancamento com diarias vinculadas mostra a contagem no dialogo'`, o objeto do array (`setor: 'mao_de_obra'`, adicionar `tipo: 'gasto'`).
5. No teste `'erro 409 simulado do backend...'`, o objeto do array.

Cada objeto ganha `tipo: 'gasto',` logo após o campo `plantio`. Exemplo (primeiro teste, mostrando o padrão a repetir nos outros 4 pontos):

```tsx
  it('lista carrega e mostra o total geral', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      { id: 2, plantio: 1, tipo: 'gasto', valor: '50.00', data: '2026-08-06', descricao: 'Frete', setor: 'transporte' },
    ])

    renderComProvider()

    expect(await screen.findByText(/Compra de mudas/)).toBeInTheDocument()
    expect(await screen.findByText('Total: R$ 200.00')).toBeInTheDocument()
  })
```

(Essa asserção `'Total: R$ 200.00'` **ainda vai passar** neste ponto — `FinanceiroPage.tsx` só muda na Task 4. Repetir o mesmo padrão `tipo: 'gasto',` nos outros 4 lugares listados acima, sem tocar em mais nada no arquivo.)

- [ ] **Step 5: Type-check o projeto inteiro**

Run (a partir de `frontend/`): `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 6: Rodar os testes tocados**

Run: `npx vitest run src/components/LancamentoForm.test.tsx src/pages/FinanceiroPage.test.tsx`
Expected: todos passam (LancamentoForm com os 3 testes novos do Step 3 — "tipo Gasto e o padrao ao criar", "trocar tipo pra ganho...", "trocar de tipo com uma categoria..." — + os já existentes; FinanceiroPage sem nenhuma mudança de resultado, só compilando agora).

- [ ] **Step 7: Rodar a suíte completa do frontend**

Run: `npx vitest run`
Expected: 44 arquivos, 254 testes passam (251 + 3 novos do Step 3).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api/lancamentos.ts frontend/src/components/LancamentoForm.tsx frontend/src/components/LancamentoForm.test.tsx frontend/src/pages/FinanceiroPage.test.tsx
git commit -m "feat(frontend): adicionar tipo gasto/ganho ao LancamentoForm"
```

---

### Task 4: Frontend — `FinanceiroPage`: filtro, três totais e estilo por tipo

**Files:**
- Modify: `frontend/src/pages/FinanceiroPage.tsx`
- Modify: `frontend/src/pages/FinanceiroPage.test.tsx`

**Interfaces:**
- Consumes: `LancamentoFinanceiro.tipo`, `TipoLancamento` (Task 3).
- Produces: nada — página final, ponta da funcionalidade.

- [ ] **Step 1: Reescrever `FinanceiroPage.tsx` inteiro**

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarLancamentos,
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
  ROTULOS_SETOR,
  type LancamentoFinanceiro,
  type LancamentoFinanceiroInput,
  type TipoLancamento,
} from '../api/lancamentos'
import { listarDiarias } from '../api/diarias'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LancamentoForm } from '../components/LancamentoForm'
import { Badge, Button, Card, EmptyState, ErrorState, IconPencil, IconTrash, LoadingState, PageHeader } from '../components/ui'

type FiltroTipo = 'todos' | TipoLancamento

function BotaoFiltro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? 'rounded-full border-2 border-ink bg-accent px-3.5 py-1.5 font-display text-sm font-bold text-accent-contrast'
          : 'rounded-full border-2 border-line bg-paper px-3.5 py-1.5 font-display text-sm font-bold text-ink-soft'
      }
    >
      {children}
    </button>
  )
}

export function FinanceiroPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<{ tipo: 'novo' } | { tipo: 'editar'; lancamento: LancamentoFinanceiro } | null>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<LancamentoFinanceiro | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroTipo>('todos')

  const lancamentosQuery = useQuery({ queryKey: ['lancamentos'], queryFn: listarLancamentos })
  const diariasQuery = useQuery({ queryKey: ['diarias'], queryFn: listarDiarias })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: typeof formulario) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarLancamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: LancamentoFinanceiroInput }) => atualizarLancamento(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirLancamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (
    lancamentosQuery.isLoading ||
    diariasQuery.isLoading ||
    plantiosQuery.isLoading ||
    talhoesQuery.isLoading ||
    culturasQuery.isLoading
  ) {
    return <LoadingState />
  }

  if (lancamentosQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar os lançamentos."
        onRetry={() => {
          lancamentosQuery.refetch()
          diariasQuery.refetch()
          plantiosQuery.refetch()
          talhoesQuery.refetch()
          culturasQuery.refetch()
        }}
      />
    )
  }

  const lancamentos = lancamentosQuery.data ?? []
  const diarias = diariasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  const plantioOpcoes = plantios.map((plantio) => ({
    id: plantio.id,
    label: labelPlantio(plantios, talhoes, culturas, plantio.id),
  }))

  function mensagemExclusao(): string {
    if (!exclusaoPendente) return ''
    if (diariasQuery.isPending || diariasQuery.isError) {
      return 'Nao foi possivel verificar se ha diarias vinculadas a este lancamento. Exclua com cautela, ou tente novamente mais tarde.'
    }
    const n = diarias.filter((d) => d.lancamento === exclusaoPendente.id).length
    return n > 0
      ? `Este lancamento paga ${n} diaria(s) e nao podera ser excluido.`
      : 'Tem certeza que deseja excluir este lancamento?'
  }

  // Totais sempre somam TODOS os lancamentos, independente do filtro de
  // exibicao ativo abaixo - trocar o filtro muda só a lista, nunca os totais.
  const totalGasto = lancamentos.filter((l) => l.tipo === 'gasto').reduce((soma, l) => soma + Number(l.valor), 0)
  const totalGanho = lancamentos.filter((l) => l.tipo === 'ganho').reduce((soma, l) => soma + Number(l.valor), 0)
  const saldoLiquido = totalGanho - totalGasto

  const lancamentosOrdenados = [...lancamentos].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  const lancamentosFiltrados =
    filtro === 'todos' ? lancamentosOrdenados : lancamentosOrdenados.filter((l) => l.tipo === filtro)

  return (
    <div>
      <PageHeader
        title="Financeiro"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo' })}>
            + Lançamento
          </Button>
        }
      />

      <Card className="mb-5 grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
        <div>
          <p className="text-sm font-bold text-ink-soft">Total gasto</p>
          <p className="font-mono text-lg font-semibold text-ink">R$ {totalGasto.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-ink-soft">Total ganho</p>
          <p className="font-mono text-lg font-semibold text-accent">R$ {totalGanho.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-ink-soft">Saldo líquido</p>
          <p className={`font-mono text-lg font-semibold ${saldoLiquido >= 0 ? 'text-accent' : 'text-ink'}`}>
            R$ {saldoLiquido.toFixed(2)}
          </p>
        </div>
      </Card>

      <div className="mb-5 flex gap-2">
        <BotaoFiltro ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos
        </BotaoFiltro>
        <BotaoFiltro ativo={filtro === 'gasto'} onClick={() => setFiltro('gasto')}>
          Gastos
        </BotaoFiltro>
        <BotaoFiltro ativo={filtro === 'ganho'} onClick={() => setFiltro('ganho')}>
          Ganhos
        </BotaoFiltro>
      </div>

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <LancamentoForm
            plantioOpcoes={plantioOpcoes}
            erro={erroFormulario}
            onSubmit={(input) => criarMutation.mutate(input)}
            onCancel={() => abrirFormulario(null)}
          />
        </Card>
      )}

      {lancamentosFiltrados.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhum lançamento registrado ainda.</EmptyState>}

      <ul className="space-y-3">
        {lancamentosFiltrados.map((lancamento) =>
          formulario?.tipo === 'editar' && formulario.lancamento.id === lancamento.id ? (
            <li key={lancamento.id}>
              <Card className="p-5">
                <LancamentoForm
                  plantioOpcoes={plantioOpcoes}
                  lancamento={lancamento}
                  erro={erroFormulario}
                  onSubmit={(input) => atualizarMutation.mutate({ id: lancamento.id, input })}
                  onCancel={() => abrirFormulario(null)}
                />
              </Card>
            </li>
          ) : (
            <li key={lancamento.id}>
              <Card className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-ink">{lancamento.descricao}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink-soft">
                    {labelPlantio(plantios, talhoes, culturas, lancamento.plantio)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{ROTULOS_SETOR[lancamento.setor]}</Badge>
                    <span className="font-mono text-sm text-ink-soft">
                      {new Date(`${lancamento.data}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 sm:shrink-0">
                  <span
                    className={
                      lancamento.tipo === 'ganho'
                        ? 'font-mono text-lg font-semibold text-accent'
                        : 'font-mono text-lg font-semibold text-ink'
                    }
                  >
                    {lancamento.tipo === 'ganho' ? '+' : '−'} R$ {lancamento.valor}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar', lancamento })}>
                      <IconPencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      onClick={() => {
                        setErroExclusao(null)
                        setExclusaoPendente(lancamento)
                      }}
                    >
                      <IconTrash className="h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ),
        )}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir lançamento"
        mensagem={mensagemExclusao()}
        erro={erroExclusao ?? undefined}
        onConfirm={() => {
          if (exclusaoPendente) excluirMutation.mutate(exclusaoPendente.id)
        }}
        onCancel={() => {
          setExclusaoPendente(null)
          setErroExclusao(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Substituir o teste de total geral por um teste dos 3 totais separados**

Em `FinanceiroPage.test.tsx`, substituir o teste `'lista carrega e mostra o total geral'` inteiro por:

```tsx
  it('lista carrega e mostra os totais separados de gasto, ganho e saldo', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      { id: 2, plantio: 1, tipo: 'gasto', valor: '30.00', data: '2026-08-06', descricao: 'Frete', setor: 'transporte' },
      { id: 3, plantio: 1, tipo: 'ganho', valor: '400.00', data: '2026-08-07', descricao: 'Venda tomate', setor: 'venda_colheita' },
    ])

    renderComProvider()

    expect(await screen.findByText(/Compra de mudas/)).toBeInTheDocument()
    expect(await screen.findByText('R$ 180.00')).toBeInTheDocument()
    expect(await screen.findByText('R$ 400.00')).toBeInTheDocument()
    expect(await screen.findByText('R$ 220.00')).toBeInTheDocument()
  })
```

(Valores escolhidos pra não colidir entre si: gasto total 180, ganho total 400, saldo 220 — três strings distintas, sem ambiguidade de `findByText`.)

- [ ] **Step 3: Adicionar o teste do filtro Todos/Gastos/Ganhos**

Adicionar logo após o teste do Step 2:

```tsx
  it('filtro mostra so os gastos, so os ganhos, ou todos', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, tipo: 'gasto', valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      { id: 2, plantio: 1, tipo: 'ganho', valor: '400.00', data: '2026-08-07', descricao: 'Venda tomate', setor: 'venda_colheita' },
    ])

    renderComProvider()
    await screen.findByText(/Compra de mudas/)
    expect(screen.getByText(/Venda tomate/)).toBeInTheDocument()

    await userEvent.click(screen.getByText('Gastos'))
    expect(screen.getByText(/Compra de mudas/)).toBeInTheDocument()
    expect(screen.queryByText(/Venda tomate/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Ganhos'))
    expect(screen.queryByText(/Compra de mudas/)).not.toBeInTheDocument()
    expect(screen.getByText(/Venda tomate/)).toBeInTheDocument()

    await userEvent.click(screen.getByText('Todos'))
    expect(screen.getByText(/Compra de mudas/)).toBeInTheDocument()
    expect(screen.getByText(/Venda tomate/)).toBeInTheDocument()
  })
```

- [ ] **Step 4: Type-check o projeto inteiro**

Run (a partir de `frontend/`): `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 5: Rodar `FinanceiroPage.test.tsx`**

Run: `npx vitest run src/pages/FinanceiroPage.test.tsx`
Expected: todos passam (o teste de total antigo foi substituído, não duplicado; + 1 teste novo de filtro).

- [ ] **Step 6: Rodar a suíte completa do frontend**

Run: `npx vitest run`
Expected: 44 arquivos, 255 testes passam (254 da Task 3 + 1 novo desta task — o de totais substituiu o antigo 1-pra-1, o de filtro é o único que soma).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/FinanceiroPage.tsx frontend/src/pages/FinanceiroPage.test.tsx
git commit -m "feat(frontend): filtro e totais separados de gasto/ganho no Financeiro"
```

---

### Task 5: Verificação final e push

**Files:** nenhum (só verificação).

- [ ] **Step 1: Rodar a suíte completa do backend**

Run (a partir de `lagoagro/`): `uv run pytest -q`
Expected: 166 testes passam.

- [ ] **Step 2: Rodar a suíte completa do frontend + type-check + lint**

Run (a partir de `frontend/`):
```bash
npx tsc -b --noEmit
npx vitest run
npx oxlint
```
Expected: `tsc` sem erros, `vitest` com 255 testes passando, `oxlint` sem novos warnings além do já conhecido e pré-existente em `AuthContext.tsx`.

- [ ] **Step 3: Rodar o detector mecânico do skill Impeccable sobre o arquivo de página tocado**

Run (a partir da raiz do repo): `node "C:\Users\Kayke Andrade\.claude\skills\impeccable\scripts\detect.mjs" --json frontend/src/pages/FinanceiroPage.tsx`
Expected: `[]` (sem achados) — `FinanceiroPage.tsx` reaproveita só componentes e cores já existentes no `DESIGN.md` (nenhuma cor nova introduzida).

- [ ] **Step 4: Push**

```bash
git push
```
