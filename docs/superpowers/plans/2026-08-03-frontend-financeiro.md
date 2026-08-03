# Frontend: financeiro (Task #8, fatia 4b/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/trabalhadores` page (Trabalhador CRUD + Diaria nested, "pagar diárias pendentes" action) and a `/financeiro` page (LancamentoFinanceiro CRUD with a running total) — closing RF08 and the last remaining piece of Task #8's backend surface.

**Architecture:** Three thin `api/*.ts` wrappers; three react-hook-form+zod forms following established conventions (`useMapeamentoErroFormulario`, the 3-generic `useForm` pattern where a `z.coerce.number()` field is present); two pages following the established `useQuery`/`useMutation` integration pattern — `TrabalhadoresPage` reuses the expandable-list pattern from `PropriedadesPage` (fatia 2), `FinanceiroPage` reuses the flat-list-with-precheck pattern from `InsumosPage` (fatia 3a). Both reuse `lib/plantio-labels.ts` (extracted just before this fatia) instead of duplicating label helpers a 4th time.

**Tech Stack:** Django REST Framework (no backend changes — everything already exists and is tested), React 19 + TypeScript, react-hook-form + zod, TanStack Query, Vitest + React Testing Library.

## Global Constraints

- Backend contract (confirmed in `lagoagro/finance/`): `Trabalhador` = `{id, nome, valor_diaria, ativo}`, full CRUD. `Diaria` = `{id, trabalhador, plantio, data, valor, lancamento}` — `valor` and `lancamento` are **`read_only`**; create/update only ever sends `{trabalhador, plantio, data}`. `LancamentoFinanceiro` = `{id, plantio, valor, data, descricao, setor}`, full CRUD. `setor` is one of `mao_de_obra | insumos | maquinario | transporte | manutencao | outros`.
- `POST /api/trabalhadores/{id}/pagar-diarias/` — no request body, returns a JSON **array** of `LancamentoFinanceiro` (the lançamentos created, grouped by plantio; empty array if there were no pending diárias — this is a normal, non-error response).
- Editing a paid `Diaria` (`lancamento !== null`) → `400`. Deleting a paid `Diaria` → `400`. Both are pre-existing, tested backend behaviors — the frontend's job is to make these unreachable through the UI (hide Editar/Excluir on a paid diária, show "Paga" instead), with the 400 as an untested-but-present safety net for the race window between render and click.
- Deleting a `Trabalhador` referenced by ANY `Diaria` (paid or not — `Diaria.trabalhador` is `on_delete=PROTECT` unconditionally) → `409` via the existing global exception handler. Deleting a `LancamentoFinanceiro` referenced by a paid `Diaria` (`Diaria.lancamento` is `on_delete=PROTECT`) → `409`, same handler.
- `valor`/`valor_diaria` are `DecimalField`s — serialize as **strings**, same pattern as `Talhao.area`/`AplicacaoInsumo.quantidade`.
- A trabalhador marked `ativo=false` still appears in every select of trabalhadores — no filtering by `ativo` anywhere in this plan (explicit user decision).
- No artificial restriction on editing a `LancamentoFinanceiro` that resulted from "pagar diárias" — the backend doesn't distinguish origin, neither does the frontend.
- `paraApiError` is imported from `../lib/api-client`; `labelPlantio` from `../lib/plantio-labels` — never redefined locally (both already extracted/established on this branch).
- `npx tsc -b` must run clean before any task is reported done. Backend is untouched in this plan (no Python changes at all) — no venv path needed for any task here.
- Every mutation must have an `onError`. "Tentar novamente" buttons must refetch every query the page depends on.

---

### Task 1: `api/lancamentos.ts` — API layer

**Files:**
- Create: `frontend/src/api/lancamentos.ts`
- Create: `frontend/src/api/lancamentos.test.ts`

**Interfaces:**
- Produces: `type SetorLancamento = 'mao_de_obra' | 'insumos' | 'maquinario' | 'transporte' | 'manutencao' | 'outros'`, `type LancamentoFinanceiro = {id, plantio, valor, data, descricao, setor}`, `type LancamentoFinanceiroInput = {plantio, valor, data, descricao, setor}`, `ROTULOS_SETOR: Record<SetorLancamento, string>`, `listarLancamentos`, `criarLancamento`, `atualizarLancamento`, `excluirLancamento`. Task 3 (`api/trabalhadores.ts`) consumes the `LancamentoFinanceiro` type; Task 6 (`LancamentoForm`) and Task 8 (`FinanceiroPage`) consume everything.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/api/lancamentos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarLancamentos, criarLancamento, atualizarLancamento, excluirLancamento } from './lancamentos'

describe('api/lancamentos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const lancamento = {
    id: 1,
    plantio: 1,
    valor: '150.00',
    data: '2026-08-05',
    descricao: 'Compra de mudas',
    setor: 'insumos' as const,
  }

  it('listarLancamentos faz GET /api/lancamentos-financeiros/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([lancamento]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarLancamentos()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([lancamento])
  })

  it('criarLancamento faz POST /api/lancamentos-financeiros/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(lancamento), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = {
      plantio: 1,
      valor: '150.00',
      data: '2026-08-05',
      descricao: 'Compra de mudas',
      setor: 'insumos' as const,
    }
    const result = await criarLancamento(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(lancamento)
  })

  it('atualizarLancamento faz PATCH /api/lancamentos-financeiros/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(lancamento), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = {
      plantio: 1,
      valor: '200.00',
      data: '2026-08-06',
      descricao: 'Compra de adubo',
      setor: 'insumos' as const,
    }
    const result = await atualizarLancamento(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(lancamento)
  })

  it('excluirLancamento faz DELETE /api/lancamentos-financeiros/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirLancamento(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/lancamentos-financeiros/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/lancamentos.test.ts`
Expected: FAIL — `Failed to resolve import "./lancamentos"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/api/lancamentos.ts`:

```ts
import { apiRequest } from '../lib/api-client'

export type SetorLancamento = 'mao_de_obra' | 'insumos' | 'maquinario' | 'transporte' | 'manutencao' | 'outros'

export type LancamentoFinanceiro = {
  id: number
  plantio: number
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export type LancamentoFinanceiroInput = {
  plantio: number
  valor: string
  data: string
  descricao: string
  setor: SetorLancamento
}

export const ROTULOS_SETOR: Record<SetorLancamento, string> = {
  mao_de_obra: 'Mão de obra',
  insumos: 'Insumos',
  maquinario: 'Maquinário/equipamentos',
  transporte: 'Transporte/frete',
  manutencao: 'Manutenção/infraestrutura',
  outros: 'Outros',
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/lancamentos.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/lancamentos.ts frontend/src/api/lancamentos.test.ts
git commit -m "feat(finance): adicionar api layer de lancamentos financeiros no frontend"
```

---

### Task 2: `api/diarias.ts` — API layer

**Files:**
- Create: `frontend/src/api/diarias.ts`
- Create: `frontend/src/api/diarias.test.ts`

**Interfaces:**
- Produces: `type Diaria = {id, trabalhador, plantio, data, valor, lancamento: number | null}`, `type DiariaInput = {trabalhador, plantio, data}`, `listarDiarias`, `criarDiaria`, `atualizarDiaria`, `excluirDiaria`. Task 5 (`DiariaForm`) and Task 7 (`TrabalhadoresPage`) consume these; Task 8 (`FinanceiroPage`) consumes `listarDiarias`/`Diaria` only, for the delete-precheck.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/api/diarias.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarDiarias, criarDiaria, atualizarDiaria, excluirDiaria } from './diarias'

describe('api/diarias', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const diaria = { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null }

  it('listarDiarias faz GET /api/diarias/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([diaria]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarDiarias()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([diaria])
  })

  it('criarDiaria faz POST /api/diarias/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(diaria), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { trabalhador: 1, plantio: 1, data: '2026-08-05' }
    const result = await criarDiaria(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(diaria)
  })

  it('atualizarDiaria faz PATCH /api/diarias/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(diaria), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { trabalhador: 1, plantio: 1, data: '2026-08-06' }
    const result = await atualizarDiaria(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(diaria)
  })

  it('excluirDiaria faz DELETE /api/diarias/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirDiaria(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/diarias/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/diarias.test.ts`
Expected: FAIL — `Failed to resolve import "./diarias"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/api/diarias.ts`:

```ts
import { apiRequest } from '../lib/api-client'

export type Diaria = {
  id: number
  trabalhador: number
  plantio: number
  data: string
  valor: string
  lancamento: number | null
}

export type DiariaInput = {
  trabalhador: number
  plantio: number
  data: string
}

export function listarDiarias(): Promise<Diaria[]> {
  return apiRequest<Diaria[]>('/diarias/')
}

export function criarDiaria(input: DiariaInput): Promise<Diaria> {
  return apiRequest<Diaria>('/diarias/', { method: 'POST', body: input })
}

export function atualizarDiaria(id: number, input: DiariaInput): Promise<Diaria> {
  return apiRequest<Diaria>(`/diarias/${id}/`, { method: 'PATCH', body: input })
}

export function excluirDiaria(id: number): Promise<void> {
  return apiRequest<void>(`/diarias/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/diarias.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/diarias.ts frontend/src/api/diarias.test.ts
git commit -m "feat(finance): adicionar api layer de diarias no frontend"
```

---

### Task 3: `api/trabalhadores.ts` — API layer

**Files:**
- Create: `frontend/src/api/trabalhadores.ts`
- Create: `frontend/src/api/trabalhadores.test.ts`

**Interfaces:**
- Consumes: `type LancamentoFinanceiro` from `../api/lancamentos` (Task 1).
- Produces: `type Trabalhador = {id, nome, valor_diaria, ativo}`, `type TrabalhadorInput = {nome, valor_diaria, ativo}`, `listarTrabalhadores`, `criarTrabalhador`, `atualizarTrabalhador`, `excluirTrabalhador`, `pagarDiariasPendentes(trabalhadorId): Promise<LancamentoFinanceiro[]>`. Task 4 (`TrabalhadorForm`) and Task 7 (`TrabalhadoresPage`) consume these.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/api/trabalhadores.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listarTrabalhadores,
  criarTrabalhador,
  atualizarTrabalhador,
  excluirTrabalhador,
  pagarDiariasPendentes,
} from './trabalhadores'

describe('api/trabalhadores', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const trabalhador = { id: 1, nome: 'Joao', valor_diaria: '120.00', ativo: true }

  it('listarTrabalhadores faz GET /api/trabalhadores/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([trabalhador]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarTrabalhadores()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([trabalhador])
  })

  it('criarTrabalhador faz POST /api/trabalhadores/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(trabalhador), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Joao', valor_diaria: '120.00', ativo: true }
    const result = await criarTrabalhador(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(trabalhador)
  })

  it('atualizarTrabalhador faz PATCH /api/trabalhadores/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(trabalhador), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Joao', valor_diaria: '130.00', ativo: false }
    const result = await atualizarTrabalhador(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(trabalhador)
  })

  it('excluirTrabalhador faz DELETE /api/trabalhadores/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirTrabalhador(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/1/')
    expect(options.method).toBe('DELETE')
  })

  it('pagarDiariasPendentes faz POST /api/trabalhadores/:id/pagar-diarias/ e retorna a lista de lancamentos', async () => {
    const lancamento = {
      id: 1,
      plantio: 1,
      valor: '240.00',
      data: '2026-08-05',
      descricao: 'Pagamento de diarias',
      setor: 'mao_de_obra' as const,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([lancamento]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await pagarDiariasPendentes(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/trabalhadores/1/pagar-diarias/')
    expect(options.method).toBe('POST')
    expect(result).toEqual([lancamento])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/trabalhadores.test.ts`
Expected: FAIL — `Failed to resolve import "./trabalhadores"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/api/trabalhadores.ts`:

```ts
import { apiRequest } from '../lib/api-client'
import type { LancamentoFinanceiro } from './lancamentos'

export type Trabalhador = {
  id: number
  nome: string
  valor_diaria: string
  ativo: boolean
}

export type TrabalhadorInput = {
  nome: string
  valor_diaria: string
  ativo: boolean
}

export function listarTrabalhadores(): Promise<Trabalhador[]> {
  return apiRequest<Trabalhador[]>('/trabalhadores/')
}

export function criarTrabalhador(input: TrabalhadorInput): Promise<Trabalhador> {
  return apiRequest<Trabalhador>('/trabalhadores/', { method: 'POST', body: input })
}

export function atualizarTrabalhador(id: number, input: TrabalhadorInput): Promise<Trabalhador> {
  return apiRequest<Trabalhador>(`/trabalhadores/${id}/`, { method: 'PATCH', body: input })
}

export function excluirTrabalhador(id: number): Promise<void> {
  return apiRequest<void>(`/trabalhadores/${id}/`, { method: 'DELETE' })
}

export function pagarDiariasPendentes(trabalhadorId: number): Promise<LancamentoFinanceiro[]> {
  return apiRequest<LancamentoFinanceiro[]>(`/trabalhadores/${trabalhadorId}/pagar-diarias/`, { method: 'POST' })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/trabalhadores.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/trabalhadores.ts frontend/src/api/trabalhadores.test.ts
git commit -m "feat(finance): adicionar api layer de trabalhadores no frontend"
```

---

### Task 4: `TrabalhadorForm` — create/edit form

**Files:**
- Create: `frontend/src/components/TrabalhadorForm.tsx`
- Create: `frontend/src/components/TrabalhadorForm.test.tsx`

**Interfaces:**
- Consumes: `Trabalhador`, `TrabalhadorInput` from `../api/trabalhadores` (Task 3); `useMapeamentoErroFormulario` from `../lib/mutation-errors`; `ApiError` from `../lib/api-client`.
- Produces: `TrabalhadorForm(props: {trabalhador?: Trabalhador; erro?: ApiError | null; onSubmit: (input: TrabalhadorInput) => void; onCancel: () => void})`. Task 7 (`TrabalhadoresPage`) consumes this.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/components/TrabalhadorForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrabalhadorForm } from './TrabalhadorForm'
import { ApiError } from '../lib/api-client'

describe('TrabalhadorForm', () => {
  it('chama onSubmit com os valores preenchidos, ativo comecando marcado', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Joao', valor_diaria: '120.00', ativo: true })
  })

  it('desmarcar ativo manda ativo: false', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByLabelText('Ativo'))
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Joao', valor_diaria: '120.00', ativo: false })
  })

  it('mostra erro de validacao e nao chama onSubmit quando nome esta vazio', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Nome e obrigatorio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando valor da diaria nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<TrabalhadorForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), 'abc')
    await userEvent.click(screen.getByText('Salvar'))

    expect(
      await screen.findByText('Valor da diaria deve ser um numero maior que zero'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um trabalhador existente', () => {
    const trabalhador = { id: 1, nome: 'Joao', valor_diaria: '120.00', ativo: false }
    render(<TrabalhadorForm trabalhador={trabalhador} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Joao')
    expect(screen.getByLabelText('Valor da diária')).toHaveValue('120.00')
    expect(screen.getByLabelText('Ativo')).not.toBeChecked()
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<TrabalhadorForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Ja existe um trabalhador com esse nome.'] })
    render(<TrabalhadorForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Ja existe um trabalhador com esse nome.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<TrabalhadorForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TrabalhadorForm.test.tsx`
Expected: FAIL — `Failed to resolve import "./TrabalhadorForm"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/TrabalhadorForm.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/TrabalhadorForm.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TrabalhadorForm.tsx frontend/src/components/TrabalhadorForm.test.tsx
git commit -m "feat(finance): adicionar TrabalhadorForm com criar/editar"
```

---

### Task 5: `DiariaForm` — create/edit form (trabalhador fixo)

**Files:**
- Create: `frontend/src/components/DiariaForm.tsx`
- Create: `frontend/src/components/DiariaForm.test.tsx`

**Interfaces:**
- Consumes: `Diaria`, `DiariaInput` from `../api/diarias` (Task 2); `type PlantioOpcao` — already exported from `frontend/src/components/AplicacaoInsumoForm.tsx:9`; `useMapeamentoErroFormulario` from `../lib/mutation-errors`; `ApiError` from `../lib/api-client`.
- Produces: `DiariaForm(props: {trabalhadorId: number; plantioOpcoes: PlantioOpcao[]; diaria?: Diaria; erro?: ApiError | null; onSubmit: (input: DiariaInput) => void; onCancel: () => void})`. Task 7 (`TrabalhadoresPage`) consumes this. `trabalhadorId` is a fixed prop — mirrors `TalhaoForm`'s `propriedadeId` prop from fatia 2 — never a select field, always injected into the submitted `DiariaInput` by the form itself.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/components/DiariaForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiariaForm } from './DiariaForm'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

describe('DiariaForm', () => {
  it('popula o select de plantio a partir das props', () => {
    render(<DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
  })

  it('chama onSubmit com o trabalhadorId fixo e os valores do formulario', async () => {
    const onSubmit = vi.fn()
    render(<DiariaForm trabalhadorId={7} plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ trabalhador: 7, plantio: 1, data: '2026-08-05' })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando uma diaria existente', () => {
    const diaria = { id: 1, trabalhador: 7, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null }
    render(
      <DiariaForm trabalhadorId={7} plantioOpcoes={plantioOpcoes} diaria={diaria} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { data: ['Ja existe uma diaria nesta data.'] })
    render(
      <DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(await screen.findByText('Ja existe uma diaria nesta data.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(400, 'Nao e possivel alterar uma diaria ja paga.', {})
    render(
      <DiariaForm trabalhadorId={1} plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(await screen.findByText('Nao e possivel alterar uma diaria ja paga.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/DiariaForm.test.tsx`
Expected: FAIL — `Failed to resolve import "./DiariaForm"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/DiariaForm.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Diaria, DiariaInput } from '../api/diarias'
import type { PlantioOpcao } from './AplicacaoInsumoForm'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  data: z.string().min(1, 'Data e obrigatoria'),
})

// Mesmo problema de z.coerce.number() ja documentado em PlantioForm.tsx/TarefaForm.tsx.
type DiariaFormInput = z.input<typeof schema>
type DiariaFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'data'] as const

type DiariaFormProps = {
  trabalhadorId: number
  plantioOpcoes: PlantioOpcao[]
  diaria?: Diaria
  erro?: ApiError | null
  onSubmit: (input: DiariaInput) => void
  onCancel: () => void
}

export function DiariaForm({ trabalhadorId, plantioOpcoes, diaria, erro, onSubmit, onCancel }: DiariaFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DiariaFormInput, unknown, DiariaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plantio: diaria?.plantio ?? 0,
      data: diaria?.data ?? '',
    },
  })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  function aoSubmeter(values: DiariaFormValues) {
    onSubmit({ trabalhador: trabalhadorId, plantio: values.plantio, data: values.data })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="diaria-plantio" className="block text-sm">
          Plantio
        </label>
        <select id="diaria-plantio" {...register('plantio')} className="border px-2 py-1">
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
        <label htmlFor="diaria-data" className="block text-sm">
          Data
        </label>
        <input id="diaria-data" type="date" {...register('data')} className="border px-2 py-1" />
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/DiariaForm.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DiariaForm.tsx frontend/src/components/DiariaForm.test.tsx
git commit -m "feat(finance): adicionar DiariaForm com trabalhador fixo"
```

---

### Task 6: `LancamentoForm` — create/edit form

**Files:**
- Create: `frontend/src/components/LancamentoForm.tsx`
- Create: `frontend/src/components/LancamentoForm.test.tsx`

**Interfaces:**
- Consumes: `ROTULOS_SETOR`, `LancamentoFinanceiro`, `LancamentoFinanceiroInput`, `SetorLancamento` from `../api/lancamentos` (Task 1); `type PlantioOpcao` from `./AplicacaoInsumoForm`; `useMapeamentoErroFormulario`; `ApiError`.
- Produces: `LancamentoForm(props: {plantioOpcoes: PlantioOpcao[]; lancamento?: LancamentoFinanceiro; erro?: ApiError | null; onSubmit: (input: LancamentoFinanceiroInput) => void; onCancel: () => void})`. Task 8 (`FinanceiroPage`) consumes this.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/components/LancamentoForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LancamentoForm } from './LancamentoForm'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

describe('LancamentoForm', () => {
  it('popula os selects de plantio e setor a partir das props', () => {
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mão de obra' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Insumos' })).toBeInTheDocument()
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
      valor: '150.00',
      data: '2026-08-05',
      descricao: 'Compra de mudas',
      setor: 'insumos' as const,
    }
    render(<LancamentoForm plantioOpcoes={plantioOpcoes} lancamento={lancamento} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Valor')).toHaveValue('150.00')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Compra de mudas')
    expect(screen.getByLabelText('Setor')).toHaveValue('insumos')
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

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/LancamentoForm.test.tsx`
Expected: FAIL — `Failed to resolve import "./LancamentoForm"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/LancamentoForm.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/LancamentoForm.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/LancamentoForm.tsx frontend/src/components/LancamentoForm.test.tsx
git commit -m "feat(finance): adicionar LancamentoForm com criar/editar"
```

---

### Task 7: `TrabalhadoresPage` — CRUD + diárias aninhadas + pagar-diárias

**Files:**
- Create: `frontend/src/pages/TrabalhadoresPage.tsx`
- Create: `frontend/src/pages/TrabalhadoresPage.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2, 3, 4, 5 (`api/trabalhadores.ts`, `api/diarias.ts`, `TrabalhadorForm`, `DiariaForm`); `listarPlantios`, `listarTalhoes`, `listarCulturas`; `labelPlantio` from `../lib/plantio-labels`; `ApiError`, `paraApiError` from `../lib/api-client`; `ConfirmDialog`.
- Produces: `TrabalhadoresPage()`. Task 9 (routing) wires this to `/trabalhadores`.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/pages/TrabalhadoresPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrabalhadoresPage } from './TrabalhadoresPage'
import * as trabalhadoresApi from '../api/trabalhadores'
import * as diariasApi from '../api/diarias'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/trabalhadores')
vi.mock('../api/diarias')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }
const trabalhador = { id: 1, nome: 'Joao', valor_diaria: '120.00', ativo: true }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TrabalhadoresPage />
    </QueryClientProvider>,
  )
}

describe('TrabalhadoresPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
  })

  it('lista carrega e renderiza os trabalhadores', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText(/Joao/)).toBeInTheDocument()
  })

  it('criar trabalhador via formulario adiciona o item a lista', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])
    vi.mocked(trabalhadoresApi.criarTrabalhador).mockResolvedValue(trabalhador)

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Trabalhador'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Joao')
    await userEvent.type(screen.getByLabelText('Valor da diária'), '120.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Joao/)).toBeInTheDocument()
  })

  it('expandir um trabalhador mostra suas diarias', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText(/Joao/))

    expect(await screen.findByText(/120.00/)).toBeInTheDocument()
  })

  it('diaria paga mostra "Paga" em vez de Editar/Excluir', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: 9 },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText(/Joao/))

    expect(await screen.findByText('Paga')).toBeInTheDocument()
  })

  it('excluir trabalhador com diarias mostra a contagem no dialogo', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null },
      { id: 2, trabalhador: 1, plantio: 1, data: '2026-08-06', valor: '120.00', lancamento: null },
    ])

    renderComProvider()
    await screen.findByText(/Joao/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(
      await screen.findByText('Este trabalhador tem 2 diaria(s) registrada(s) e nao podera ser excluido.'),
    ).toBeInTheDocument()
  })

  it('pagar diarias pendentes mostra a contagem e, ao confirmar, a mensagem de sucesso', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-05', valor: '120.00', lancamento: null },
    ])
    vi.mocked(trabalhadoresApi.pagarDiariasPendentes).mockResolvedValue([
      {
        id: 9,
        plantio: 1,
        valor: '120.00',
        data: '2026-08-05',
        descricao: 'Pagamento de diarias',
        setor: 'mao_de_obra',
      },
    ])

    renderComProvider()
    await screen.findByText(/Joao/)
    await userEvent.click(screen.getByText('Pagar diárias pendentes'))

    expect(await screen.findByText('Isso vai gerar 1 lancamento(s) de mao de obra.')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Confirmar'))

    expect(await screen.findByText('1 lançamento(s) de mão de obra criado(s).')).toBeInTheDocument()
  })

  it('pagar diarias sem pendencias mostra mensagem de nenhuma pendencia', async () => {
    vi.mocked(trabalhadoresApi.listarTrabalhadores).mockResolvedValue([trabalhador])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])

    renderComProvider()
    await screen.findByText(/Joao/)
    await userEvent.click(screen.getByText('Pagar diárias pendentes'))

    expect(await screen.findByText('Nenhuma diaria pendente para pagar.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/TrabalhadoresPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./TrabalhadoresPage"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/pages/TrabalhadoresPage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarTrabalhadores,
  criarTrabalhador,
  atualizarTrabalhador,
  excluirTrabalhador,
  pagarDiariasPendentes,
  type Trabalhador,
  type TrabalhadorInput,
} from '../api/trabalhadores'
import { listarDiarias, criarDiaria, atualizarDiaria, excluirDiaria, type Diaria, type DiariaInput } from '../api/diarias'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TrabalhadorForm } from '../components/TrabalhadorForm'
import { DiariaForm } from '../components/DiariaForm'

type FormularioAberto =
  | { tipo: 'novo-trabalhador' }
  | { tipo: 'editar-trabalhador'; trabalhador: Trabalhador }
  | { tipo: 'nova-diaria'; trabalhadorId: number }
  | { tipo: 'editar-diaria'; diaria: Diaria }
  | null

type ExclusaoPendente = { tipo: 'trabalhador'; trabalhador: Trabalhador } | { tipo: 'diaria'; diaria: Diaria } | null

export function TrabalhadoresPage() {
  const queryClient = useQueryClient()
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<ExclusaoPendente>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [pagamentoPendente, setPagamentoPendente] = useState<Trabalhador | null>(null)
  const [erroPagamento, setErroPagamento] = useState<string | null>(null)
  const [mensagemPagamento, setMensagemPagamento] = useState<string | null>(null)

  const trabalhadoresQuery = useQuery({ queryKey: ['trabalhadores'], queryFn: listarTrabalhadores })
  const diariasQuery = useQuery({ queryKey: ['diarias'], queryFn: listarDiarias })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  function alternarExpansao(trabalhadorId: number) {
    setExpandidos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(trabalhadorId)) {
        proximo.delete(trabalhadorId)
      } else {
        proximo.add(trabalhadorId)
      }
      return proximo
    })
  }

  const criarTrabalhadorMutation = useMutation({
    mutationFn: criarTrabalhador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trabalhadores'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarTrabalhadorMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: TrabalhadorInput }) => atualizarTrabalhador(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trabalhadores'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirTrabalhadorMutation = useMutation({
    mutationFn: excluirTrabalhador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trabalhadores'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  const criarDiariaMutation = useMutation({
    mutationFn: criarDiaria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarDiariaMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: DiariaInput }) => atualizarDiaria(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirDiariaMutation = useMutation({
    mutationFn: excluirDiaria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  const pagarDiariasMutation = useMutation({
    mutationFn: pagarDiariasPendentes,
    onSuccess: (lancamentosCriados) => {
      queryClient.invalidateQueries({ queryKey: ['diarias'] })
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
      setPagamentoPendente(null)
      setErroPagamento(null)
      setMensagemPagamento(
        lancamentosCriados.length > 0
          ? `${lancamentosCriados.length} lançamento(s) de mão de obra criado(s).`
          : 'Nenhuma diária pendente para pagar.',
      )
    },
    onError: (erro) => setErroPagamento(paraApiError(erro).message),
  })

  if (
    trabalhadoresQuery.isLoading ||
    diariasQuery.isLoading ||
    plantiosQuery.isLoading ||
    talhoesQuery.isLoading ||
    culturasQuery.isLoading
  ) {
    return <p>Carregando...</p>
  }

  if (
    trabalhadoresQuery.isError ||
    diariasQuery.isError ||
    plantiosQuery.isError ||
    talhoesQuery.isError ||
    culturasQuery.isError
  ) {
    return (
      <div>
        <p>Nao foi possivel carregar os trabalhadores.</p>
        <button
          onClick={() => {
            trabalhadoresQuery.refetch()
            diariasQuery.refetch()
            plantiosQuery.refetch()
            talhoesQuery.refetch()
            culturasQuery.refetch()
          }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const trabalhadores = trabalhadoresQuery.data ?? []
  const diarias = diariasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  const plantioOpcoes = plantios.map((plantio) => ({
    id: plantio.id,
    label: labelPlantio(plantios, talhoes, culturas, plantio.id),
  }))

  function mensagemExclusao(): string {
    if (exclusaoPendente?.tipo === 'trabalhador') {
      const n = diarias.filter((d) => d.trabalhador === exclusaoPendente.trabalhador.id).length
      return n > 0
        ? `Este trabalhador tem ${n} diaria(s) registrada(s) e nao podera ser excluido.`
        : 'Tem certeza que deseja excluir este trabalhador?'
    }
    if (exclusaoPendente?.tipo === 'diaria') {
      return 'Tem certeza que deseja excluir esta diaria?'
    }
    return ''
  }

  function mensagemConfirmacaoPagamento(trabalhador: Trabalhador): string {
    const plantiosPendentes = new Set(
      diarias.filter((d) => d.trabalhador === trabalhador.id && d.lancamento === null).map((d) => d.plantio),
    )
    return plantiosPendentes.size > 0
      ? `Isso vai gerar ${plantiosPendentes.size} lancamento(s) de mao de obra.`
      : 'Nenhuma diaria pendente para pagar.'
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Trabalhadores</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo-trabalhador' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Trabalhador
        </button>
      </div>

      {mensagemPagamento && <p className="mb-2 text-sm text-green-700">{mensagemPagamento}</p>}

      {formulario?.tipo === 'novo-trabalhador' && (
        <TrabalhadorForm
          erro={erroFormulario}
          onSubmit={(input) => criarTrabalhadorMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {trabalhadores.map((trabalhador) => {
          const diariasDoTrabalhador = diarias.filter((d) => d.trabalhador === trabalhador.id)
          const expandido = expandidos.has(trabalhador.id)

          return (
            <li key={trabalhador.id} className="mb-2 border p-2">
              {formulario?.tipo === 'editar-trabalhador' && formulario.trabalhador.id === trabalhador.id ? (
                <TrabalhadorForm
                  trabalhador={trabalhador}
                  erro={erroFormulario}
                  onSubmit={(input) => atualizarTrabalhadorMutation.mutate({ id: trabalhador.id, input })}
                  onCancel={() => abrirFormulario(null)}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <button onClick={() => alternarExpansao(trabalhador.id)} className="text-left font-semibold">
                    {expandido ? '▾' : '▸'} {trabalhador.nome} — R$ {trabalhador.valor_diaria}/diária
                    {!trabalhador.ativo && ' (inativo)'}
                  </button>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => {
                        setErroPagamento(null)
                        setMensagemPagamento(null)
                        setPagamentoPendente(trabalhador)
                      }}
                    >
                      Pagar diárias pendentes
                    </button>
                    <button onClick={() => abrirFormulario({ tipo: 'editar-trabalhador', trabalhador })}>
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        setErroExclusao(null)
                        setExclusaoPendente({ tipo: 'trabalhador', trabalhador })
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}

              {expandido && (
                <div className="ml-4 mt-2">
                  {formulario?.tipo === 'nova-diaria' && formulario.trabalhadorId === trabalhador.id && (
                    <DiariaForm
                      trabalhadorId={trabalhador.id}
                      plantioOpcoes={plantioOpcoes}
                      erro={erroFormulario}
                      onSubmit={(input) => criarDiariaMutation.mutate(input)}
                      onCancel={() => abrirFormulario(null)}
                    />
                  )}
                  <ul>
                    {diariasDoTrabalhador.map((diaria) => (
                      <li key={diaria.id} className="mb-1 flex items-center justify-between">
                        {formulario?.tipo === 'editar-diaria' && formulario.diaria.id === diaria.id ? (
                          <DiariaForm
                            trabalhadorId={trabalhador.id}
                            plantioOpcoes={plantioOpcoes}
                            diaria={diaria}
                            erro={erroFormulario}
                            onSubmit={(input) => atualizarDiariaMutation.mutate({ id: diaria.id, input })}
                            onCancel={() => abrirFormulario(null)}
                          />
                        ) : (
                          <>
                            <span>
                              {labelPlantio(plantios, talhoes, culturas, diaria.plantio)} —{' '}
                              {new Date(`${diaria.data}T00:00:00`).toLocaleDateString('pt-BR')} — R$ {diaria.valor}
                            </span>
                            {diaria.lancamento !== null ? (
                              <span className="text-sm text-gray-500">Paga</span>
                            ) : (
                              <div className="flex gap-2 text-sm">
                                <button onClick={() => abrirFormulario({ tipo: 'editar-diaria', diaria })}>
                                  Editar
                                </button>
                                <button
                                  onClick={() => {
                                    setErroExclusao(null)
                                    setExclusaoPendente({ tipo: 'diaria', diaria })
                                  }}
                                >
                                  Excluir
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => abrirFormulario({ tipo: 'nova-diaria', trabalhadorId: trabalhador.id })}
                    className="mt-1 text-sm"
                  >
                    + Diária
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo={exclusaoPendente?.tipo === 'trabalhador' ? 'Excluir trabalhador' : 'Excluir diaria'}
        mensagem={mensagemExclusao()}
        erro={erroExclusao ?? undefined}
        onConfirm={() => {
          if (exclusaoPendente?.tipo === 'trabalhador') {
            excluirTrabalhadorMutation.mutate(exclusaoPendente.trabalhador.id)
          } else if (exclusaoPendente?.tipo === 'diaria') {
            excluirDiariaMutation.mutate(exclusaoPendente.diaria.id)
          }
        }}
        onCancel={() => {
          setExclusaoPendente(null)
          setErroExclusao(null)
        }}
      />

      <ConfirmDialog
        aberto={pagamentoPendente !== null}
        titulo="Pagar diárias pendentes"
        mensagem={pagamentoPendente ? mensagemConfirmacaoPagamento(pagamentoPendente) : ''}
        erro={erroPagamento ?? undefined}
        onConfirm={() => {
          if (pagamentoPendente) pagarDiariasMutation.mutate(pagamentoPendente.id)
        }}
        onCancel={() => {
          setPagamentoPendente(null)
          setErroPagamento(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/TrabalhadoresPage.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TrabalhadoresPage.tsx frontend/src/pages/TrabalhadoresPage.test.tsx
git commit -m "feat(finance): adicionar TrabalhadoresPage com diarias aninhadas e pagar-diarias"
```

---

### Task 8: `FinanceiroPage` — lista de lançamentos + total geral

**Files:**
- Create: `frontend/src/pages/FinanceiroPage.tsx`
- Create: `frontend/src/pages/FinanceiroPage.test.tsx`

**Interfaces:**
- Consumes: everything from Task 1 (`api/lancamentos.ts`), Task 6 (`LancamentoForm`); `listarDiarias` from `../api/diarias` (Task 2, for delete precheck only); `listarPlantios`/`listarTalhoes`/`listarCulturas`; `labelPlantio`; `ApiError`, `paraApiError`; `ConfirmDialog`.
- Produces: `FinanceiroPage()`. Task 9 (routing) wires this to `/financeiro`.

**Deliberate exception to "check every query's `isError`":** `diariasQuery` is used ONLY for the delete-precheck (`mensagemExclusao`), never to render primary page content — so it is intentionally left OUT of the page's hard-error gate (the `if (...isError) return <error page>` block), exactly mirroring `InsumosPage.tsx`'s original, never-flagged-as-a-bug treatment of `aplicacoesQuery` in fatia 3a. `mensagemExclusao` already degrades gracefully (`diariasQuery.isPending || diariasQuery.isError` → a cautious inline message) instead of blocking the whole page over a precheck-only data source. This is different from `TrabalhadoresPage` (Task 7), where `diariasQuery` genuinely IS primary content (nested diária lists) and therefore DOES belong in that page's hard-error gate. Do not "fix" this apparent inconsistency by adding `diariasQuery.isError` to `FinanceiroPage`'s hard gate — it is intentional, not an oversight.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/pages/FinanceiroPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinanceiroPage } from './FinanceiroPage'
import * as lancamentosApi from '../api/lancamentos'
import * as diariasApi from '../api/diarias'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/lancamentos')
vi.mock('../api/diarias')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <FinanceiroPage />
    </QueryClientProvider>,
  )
}

describe('FinanceiroPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([])
  })

  it('lista carrega e mostra o total geral', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      { id: 2, plantio: 1, valor: '50.00', data: '2026-08-06', descricao: 'Frete', setor: 'transporte' },
    ])

    renderComProvider()

    expect(await screen.findByText(/Compra de mudas/)).toBeInTheDocument()
    expect(await screen.findByText('Total: R$ 200.00')).toBeInTheDocument()
  })

  it('criar lancamento via formulario adiciona o item a lista', async () => {
    vi.mocked(lancamentosApi.listarLancamentos)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, plantio: 1, valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
      ])
    vi.mocked(lancamentosApi.criarLancamento).mockResolvedValue({
      id: 1,
      plantio: 1,
      valor: '150.00',
      data: '2026-08-05',
      descricao: 'Compra de mudas',
      setor: 'insumos',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Lançamento'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Valor'), '150.00')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Compra de mudas')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Compra de mudas/)).toBeInTheDocument()
  })

  it('excluir lancamento sem diarias vinculadas nao mostra aviso de uso', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, valor: '150.00', data: '2026-08-05', descricao: 'Compra de mudas', setor: 'insumos' },
    ])

    renderComProvider()
    await screen.findByText(/Compra de mudas/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(await screen.findByText('Tem certeza que deseja excluir este lancamento?')).toBeInTheDocument()
  })

  it('excluir lancamento com diarias vinculadas mostra a contagem no dialogo', async () => {
    vi.mocked(lancamentosApi.listarLancamentos).mockResolvedValue([
      { id: 1, plantio: 1, valor: '120.00', data: '2026-08-05', descricao: 'Pagamento de diarias', setor: 'mao_de_obra' },
    ])
    vi.mocked(diariasApi.listarDiarias).mockResolvedValue([
      { id: 1, trabalhador: 1, plantio: 1, data: '2026-08-01', valor: '120.00', lancamento: 1 },
    ])

    renderComProvider()
    await screen.findByText(/Pagamento de diarias/)
    await userEvent.click(screen.getByText('Excluir'))

    expect(
      await screen.findByText('Este lancamento paga 1 diaria(s) e nao podera ser excluido.'),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/FinanceiroPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./FinanceiroPage"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/pages/FinanceiroPage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarLancamentos,
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
  ROTULOS_SETOR,
  type LancamentoFinanceiro,
  type LancamentoFinanceiroInput,
} from '../api/lancamentos'
import { listarDiarias } from '../api/diarias'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { labelPlantio } from '../lib/plantio-labels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LancamentoForm } from '../components/LancamentoForm'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; lancamento: LancamentoFinanceiro } | null

export function FinanceiroPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<LancamentoFinanceiro | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const lancamentosQuery = useQuery({ queryKey: ['lancamentos'], queryFn: listarLancamentos })
  const diariasQuery = useQuery({ queryKey: ['diarias'], queryFn: listarDiarias })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
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
    return <p>Carregando...</p>
  }

  if (
    lancamentosQuery.isError ||
    plantiosQuery.isError ||
    talhoesQuery.isError ||
    culturasQuery.isError
  ) {
    return (
      <div>
        <p>Nao foi possivel carregar os lancamentos.</p>
        <button
          onClick={() => {
            lancamentosQuery.refetch()
            diariasQuery.refetch()
            plantiosQuery.refetch()
            talhoesQuery.refetch()
            culturasQuery.refetch()
          }}
        >
          Tentar novamente
        </button>
      </div>
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

  const lancamentosOrdenados = [...lancamentos].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  const totalGeral = lancamentos.reduce((soma, lancamento) => soma + Number(lancamento.valor), 0)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Financeiro</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Lançamento
        </button>
      </div>

      <p className="mb-4 font-semibold">Total: R$ {totalGeral.toFixed(2)}</p>

      {formulario?.tipo === 'novo' && (
        <LancamentoForm
          plantioOpcoes={plantioOpcoes}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {lancamentosOrdenados.map((lancamento) =>
          formulario?.tipo === 'editar' && formulario.lancamento.id === lancamento.id ? (
            <li key={lancamento.id} className="mb-2 border p-2">
              <LancamentoForm
                plantioOpcoes={plantioOpcoes}
                lancamento={lancamento}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: lancamento.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={lancamento.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {labelPlantio(plantios, talhoes, culturas, lancamento.plantio)} —{' '}
                {new Date(`${lancamento.data}T00:00:00`).toLocaleDateString('pt-BR')} — {lancamento.descricao} —{' '}
                {ROTULOS_SETOR[lancamento.setor]} — R$ {lancamento.valor}
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', lancamento })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(lancamento)
                  }}
                >
                  Excluir
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir lancamento"
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/FinanceiroPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/FinanceiroPage.tsx frontend/src/pages/FinanceiroPage.test.tsx
git commit -m "feat(finance): adicionar FinanceiroPage com total geral"
```

---

### Task 9: Routing and navigation

**Files:**
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/layout/AppShell.tsx`
- Modify: `frontend/src/routes.test.tsx`

**Interfaces:**
- Consumes: `TrabalhadoresPage` from `../pages/TrabalhadoresPage` (Task 7); `FinanceiroPage` from `../pages/FinanceiroPage` (Task 8).

- [ ] **Step 1: Write the failing tests — append to `routes.test.tsx`**

In `frontend/src/routes.test.tsx`, inside the existing `describe('navegacao para as paginas de cadastro', ...)` block (after the "Colheitas" test added in fatia 4a, before the closing `})` of that `describe`), add:

```tsx
  it('link de Trabalhadores navega para a pagina de trabalhadores', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // TrabalhadoresPage dispara 5 fetches paralelos (trabalhadores/diarias/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Trabalhadores' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trabalhadores' })).toBeInTheDocument())
  })

  it('link de Financeiro navega para a pagina de financeiro', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // FinanceiroPage dispara 5 fetches paralelos (lancamentos/diarias/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Financeiro' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument())
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: FAIL — no links named "Trabalhadores"/"Financeiro" exist yet.

- [ ] **Step 3: Add the routes**

In `frontend/src/routes.tsx`, add the imports (after the `ColheitasPage` import):

```ts
import { TrabalhadoresPage } from './pages/TrabalhadoresPage'
import { FinanceiroPage } from './pages/FinanceiroPage'
```

Add the route objects (after the `/colheitas` route, before the `{ path: '*', ... }` catch-all):

```tsx
  {
    path: '/trabalhadores',
    element: (
      <ProtectedRoute>
        <AppShell>
          <TrabalhadoresPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/financeiro',
    element: (
      <ProtectedRoute>
        <AppShell>
          <FinanceiroPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
```

- [ ] **Step 4: Add the nav links**

In `frontend/src/layout/AppShell.tsx`, add two links after the "Colheitas" link, inside the existing `<nav>`:

```tsx
            <Link to="/trabalhadores">Trabalhadores</Link>
            <Link to="/financeiro">Financeiro</Link>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: PASS (all tests in the file, including the 2 new ones).

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, all test files green.

- [ ] **Step 7: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes.tsx frontend/src/layout/AppShell.tsx frontend/src/routes.test.tsx
git commit -m "feat(frontend): adicionar rotas e navegacao para trabalhadores e financeiro"
```

---

## Post-plan: whole-branch review

After all 9 tasks are committed, run the final whole-branch review covering the full diff against `master`, with special attention to:

- Every mutation across `TrabalhadoresPage` and `FinanceiroPage` has an `onError`, and every "Tentar novamente" button refetches every query the page depends on.
- A paid `Diaria` (`lancamento !== null`) never exposes Editar/Excluir anywhere in the UI — only the "Paga" label.
- The two pre-checks (excluir trabalhador, excluir lançamento) count the right thing: trabalhador counts ALL diárias (paid or not, since `PROTECT` is unconditional); lançamento counts diárias whose `lancamento` field equals that lançamento's id.
- `CAMPOS_CONHECIDOS` in every new form has a matching `{errors.<campo> && ...}` render slot for every entry — this exact class of bug was caught in both fatia 3a and fatia 4a's final reviews.
- `mensagemConfirmacaoPagamento` groups by distinct `plantio`, matching the backend's own grouping logic in `pagar_diarias_pendentes` — the count shown to the user before confirming should match the number of lançamentos actually created.
