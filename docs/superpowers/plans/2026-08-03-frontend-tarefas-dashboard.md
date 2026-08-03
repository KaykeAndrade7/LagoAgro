# Frontend: tarefas + dashboard RF12 (Task #8, fatia 3b/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/tarefas` page with full CRUD for `Tarefa` (RF10) and rewrite `DashboardPage` into the RF12 panel showing pending tasks grouped by talhão, both actionable via an inline "mark done" checkbox — while extracting the mutation-error-mapping pattern (duplicated in `InsumoForm`/`AplicacaoInsumoForm` since fatia 3a) into a shared hook.

**Architecture:** Same conventions as fatias 2 and 3a: a thin `api/tarefas.ts` wrapper over `apiRequest<T>()`, a react-hook-form+zod `TarefaForm`, TanStack Query (`useQuery`/`useMutation`, no custom hooks per entity) in the pages, `ConfirmDialog` for delete confirmation. New this fatia: a presentational `TarefaItem` component (checkbox + text) shared between `TarefasPage` and `DashboardPage`, and a generic `useMapeamentoErroFormulario` hook in `lib/` shared across all three forms that map backend field errors.

**Tech Stack:** React 19, TypeScript, react-hook-form 7 + zod 4 + `@hookform/resolvers/zod`, TanStack Query 5, Tailwind, Vitest + React Testing Library + `@testing-library/user-event`.

## Global Constraints

- Backend contract (confirmed in `lagoagro/tasks/{models,serializers,views}.py`): `TarefaSerializer` = `{id, plantio, descricao, data, concluida}`. `plantio` is a FK ID, scoped to the authenticated user's plantios in the serializer's `__init__` (same pattern as `AplicacaoInsumoSerializer`). `TarefaViewSet` is a full `ModelViewSet` — PATCH (partial) already works and is already scoped by `UsuarioScopedQuerySetMixin`. No backend change needed.
- Endpoint path: `/api/tarefas/` (registered in `core/urls.py:38`).
- `TarefaInput` (the type sent on create/update) is `{plantio, descricao, data}` — **no `concluida`**. Marking a task done/undone is a separate, dedicated call (`alterarConclusao`) that PATCHes only `{concluida}`.
- `z.coerce.number()` on a select field makes the *input* type of that field `unknown` and the *output* type `number`. Any form with such a field must use the 3-generic `useForm<Input, Context, Values>` signature (`type X = z.input<typeof schema>`, `type Y = z.output<typeof schema>`), never `z.infer`/single-generic — see `PlantioForm.tsx:15-22` and `AplicacaoInsumoForm.tsx:21-25` for the existing pattern and its rationale.
- Date-only strings from the backend (`YYYY-MM-DD`) are always displayed via `new Date(\`${data}T00:00:00\`).toLocaleDateString('pt-BR')` — a bare `new Date(data)` shifts by timezone. The same care applies to computing "today" for the "atrasada" (overdue) comparison: use local date components (`getFullYear`/`getMonth`/`getDate`), never `new Date().toISOString()` (which is UTC and can be off by one day near midnight in non-UTC timezones).
- Mutation error mapping: `ApiError.body` is `{campo: ["mensagem"]}` on a 400, or `{detail: "..."}` on other errors (409, 500). Every mutation that can fail from user input needs an `onError` — the fatia 3a final review flagged a delete mutation with no `onError` as an Important bug; do not repeat that gap on the new "mark done" checkbox mutation.
- No custom hooks per entity (no `useTarefas()`, no `useInsumos()`). The one exception, explicitly requested by the user (2026-08-03), is `useMapeamentoErroFormulario` — a single generic, cross-cutting hook (parameterized over the form's field types), not a per-entity hook.
- `npx tsc -b` must run clean (`cd frontend && npx tsc -b`) before any task is reported done, and independently re-verified by that task's reviewer.
- Tests: Vitest + React Testing Library + `@testing-library/user-event`. API-layer tests mock global `fetch` via `vi.stubGlobal('fetch', ...)`. Page/integration tests mock the `api/*` modules via `vi.mock('../api/x')`.

---

### Task 1: `lib/mutation-errors.ts` — shared mutation-error-mapping hook, refactor existing forms to use it

**Files:**
- Create: `frontend/src/lib/mutation-errors.ts`
- Create: `frontend/src/lib/mutation-errors.test.ts`
- Modify: `frontend/src/components/InsumoForm.tsx`
- Modify: `frontend/src/components/AplicacaoInsumoForm.tsx`

**Interfaces:**
- Produces: `useMapeamentoErroFormulario<T extends FieldValues>(erro: ApiError | null | undefined, setError: UseFormSetError<T>, camposConhecidos: readonly Path<T>[]): void` — exported from `frontend/src/lib/mutation-errors.ts`. Tasks 3 (`TarefaForm`) consumes this directly.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/lib/mutation-errors.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMapeamentoErroFormulario } from './mutation-errors'
import { ApiError } from './api-client'

type FormularioTeste = { nome: string; idade: number }

describe('useMapeamentoErroFormulario', () => {
  it('mapeia erro de campo conhecido para setError', () => {
    const setError = vi.fn()
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Nome invalido.'] })

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('nome', { message: 'Nome invalido.' })
    expect(setError).not.toHaveBeenCalledWith('root', expect.anything())
  })

  it('mapeia mais de um campo conhecido quando o backend devolve os dois', () => {
    const setError = vi.fn()
    const erro = new ApiError(400, 'Erro de validacao', {
      nome: ['Nome invalido.'],
      idade: ['Idade invalida.'],
    })

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('nome', { message: 'Nome invalido.' })
    expect(setError).toHaveBeenCalledWith('idade', { message: 'Idade invalida.' })
  })

  it('cai no root quando nenhum campo conhecido bate', () => {
    const setError = vi.fn()
    const erro = new ApiError(500, 'Erro interno do servidor.', {})

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('root', { message: 'Erro interno do servidor.' })
  })

  it('usa o detail do corpo quando presente, mesmo sem campo conhecido', () => {
    const setError = vi.fn()
    const erro = new ApiError(409, 'Erro', { detail: 'Conflito de dados.' })

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(erro, setError, ['nome', 'idade']))

    expect(setError).toHaveBeenCalledWith('root', { message: 'Conflito de dados.' })
  })

  it('nao chama setError quando erro e null', () => {
    const setError = vi.fn()

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(null, setError, ['nome', 'idade']))

    expect(setError).not.toHaveBeenCalled()
  })

  it('nao chama setError quando erro e undefined', () => {
    const setError = vi.fn()

    renderHook(() => useMapeamentoErroFormulario<FormularioTeste>(undefined, setError, ['nome', 'idade']))

    expect(setError).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/mutation-errors.test.ts`
Expected: FAIL — `Failed to resolve import "./mutation-errors"` (the module doesn't exist yet).

- [ ] **Step 3: Write the hook implementation**

Create `frontend/src/lib/mutation-errors.ts`:

```ts
import { useEffect } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ApiError } from './api-client'

export function useMapeamentoErroFormulario<T extends FieldValues>(
  erro: ApiError | null | undefined,
  setError: UseFormSetError<T>,
  camposConhecidos: readonly Path<T>[],
): void {
  useEffect(() => {
    if (!erro) return
    const body = erro.body as Record<string, unknown> | null | undefined
    let algumCampoMapeado = false
    for (const campo of camposConhecidos) {
      const mensagens = body?.[campo]
      if (Array.isArray(mensagens) && typeof mensagens[0] === 'string') {
        setError(campo, { message: mensagens[0] })
        algumCampoMapeado = true
      }
    }
    if (!algumCampoMapeado) {
      const detail = typeof body?.detail === 'string' ? body.detail : erro.message
      setError('root', { message: detail })
    }
  }, [erro, setError, camposConhecidos])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/mutation-errors.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Refactor `InsumoForm.tsx` to use the shared hook**

In `frontend/src/components/InsumoForm.tsx`:

Remove the `useEffect` import (line 1) — it becomes unused. Add an import for the new hook:

```ts
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
```

Replace the existing inline `useEffect` block (the one starting `useEffect(() => { if (!erro) return ... }, [erro, setError])`) with a single call:

```ts
useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)
```

Nothing else in the file changes — `CAMPOS_CONHECIDOS`, the JSX, and the rest of the component stay exactly as they are.

- [ ] **Step 6: Refactor `AplicacaoInsumoForm.tsx` to use the shared hook**

Same change in `frontend/src/components/AplicacaoInsumoForm.tsx`: remove the `useEffect` import, add `import { useMapeamentoErroFormulario } from '../lib/mutation-errors'`, replace the inline `useEffect` block with:

```ts
useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)
```

- [ ] **Step 7: Run the existing test suites for both refactored forms — confirm no behavior regression**

Run: `cd frontend && npx vitest run src/components/InsumoForm.test.tsx src/components/AplicacaoInsumoForm.test.tsx`
Expected: PASS, same test count as before (`InsumoForm.test.tsx`: 8 tests; `AplicacaoInsumoForm.test.tsx`: 7 tests). These test files are NOT modified by this task — if any assertion about error-mapping behavior fails, the refactor changed observable behavior, which is a bug.

- [ ] **Step 8: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/mutation-errors.ts frontend/src/lib/mutation-errors.test.ts frontend/src/components/InsumoForm.tsx frontend/src/components/AplicacaoInsumoForm.tsx
git commit -m "refactor(frontend): extrair mapeamento de erro de mutacao para hook compartilhado"
```

---

### Task 2: `api/tarefas.ts` — API layer

**Files:**
- Create: `frontend/src/api/tarefas.ts`
- Create: `frontend/src/api/tarefas.test.ts`

**Interfaces:**
- Produces: `type Tarefa = {id: number; plantio: number; descricao: string; data: string; concluida: boolean}`, `type TarefaInput = {plantio: number; descricao: string; data: string}`, `listarTarefas(): Promise<Tarefa[]>`, `criarTarefa(input: TarefaInput): Promise<Tarefa>`, `atualizarTarefa(id: number, input: TarefaInput): Promise<Tarefa>`, `excluirTarefa(id: number): Promise<void>`, `alterarConclusao(id: number, concluida: boolean): Promise<Tarefa>`. Tasks 3, 5, 6 consume these.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/api/tarefas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarTarefas, criarTarefa, atualizarTarefa, excluirTarefa, alterarConclusao } from './tarefas'

describe('api/tarefas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const tarefa = { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }

  it('listarTarefas faz GET /api/tarefas/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([tarefa]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarTarefas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([tarefa])
  })

  it('criarTarefa faz POST /api/tarefas/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(tarefa), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, descricao: 'Regar', data: '2026-08-05' }
    const result = await criarTarefa(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(tarefa)
  })

  it('atualizarTarefa faz PATCH /api/tarefas/:id/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(tarefa), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, descricao: 'Regar de manha', data: '2026-08-06' }
    const result = await atualizarTarefa(1, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(tarefa)
  })

  it('excluirTarefa faz DELETE /api/tarefas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirTarefa(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/1/')
    expect(options.method).toBe('DELETE')
  })

  it('alterarConclusao faz PATCH /api/tarefas/:id/ so com {concluida}', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ...tarefa, concluida: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await alterarConclusao(1, true)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tarefas/1/')
    expect(options.method).toBe('PATCH')
    expect(options.body).toBe(JSON.stringify({ concluida: true }))
    expect(result).toEqual({ ...tarefa, concluida: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/tarefas.test.ts`
Expected: FAIL — `Failed to resolve import "./tarefas"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/api/tarefas.ts`:

```ts
import { apiRequest } from '../lib/api-client'

export type Tarefa = {
  id: number
  plantio: number
  descricao: string
  data: string
  concluida: boolean
}

export type TarefaInput = {
  plantio: number
  descricao: string
  data: string
}

export function listarTarefas(): Promise<Tarefa[]> {
  return apiRequest<Tarefa[]>('/tarefas/')
}

export function criarTarefa(input: TarefaInput): Promise<Tarefa> {
  return apiRequest<Tarefa>('/tarefas/', { method: 'POST', body: input })
}

export function atualizarTarefa(id: number, input: TarefaInput): Promise<Tarefa> {
  return apiRequest<Tarefa>(`/tarefas/${id}/`, { method: 'PATCH', body: input })
}

export function excluirTarefa(id: number): Promise<void> {
  return apiRequest<void>(`/tarefas/${id}/`, { method: 'DELETE' })
}

export function alterarConclusao(id: number, concluida: boolean): Promise<Tarefa> {
  return apiRequest<Tarefa>(`/tarefas/${id}/`, { method: 'PATCH', body: { concluida } })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/tarefas.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/tarefas.ts frontend/src/api/tarefas.test.ts
git commit -m "feat(tasks): adicionar api layer de tarefas no frontend"
```

---

### Task 3: `TarefaForm` — create/edit form

**Files:**
- Create: `frontend/src/components/TarefaForm.tsx`
- Create: `frontend/src/components/TarefaForm.test.tsx`

**Interfaces:**
- Consumes: `useMapeamentoErroFormulario` from `../lib/mutation-errors` (Task 1); `Tarefa`, `TarefaInput` from `../api/tarefas` (Task 2); `type PlantioOpcao = {id: number; label: string}` — already exported from `frontend/src/components/AplicacaoInsumoForm.tsx:9`; `ApiError` from `../lib/api-client`.
- Produces: `TarefaForm(props: {plantioOpcoes: PlantioOpcao[]; tarefa?: Tarefa; erro?: ApiError | null; onSubmit: (input: TarefaInput) => void; onCancel: () => void})`. Task 5 (`TarefasPage`) consumes this.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/components/TarefaForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TarefaForm } from './TarefaForm'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

describe('TarefaForm', () => {
  it('popula o select de plantio a partir das props', () => {
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores preenchidos', async () => {
    const onSubmit = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Regar')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ plantio: 1, descricao: 'Regar', data: '2026-08-05' })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Descrição'), 'Regar')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando descricao esta vazia', async () => {
    const onSubmit = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Descricao e obrigatoria')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando uma tarefa existente', () => {
    const tarefa = { id: 1, plantio: 1, descricao: 'Tarefa existente', data: '2026-08-05', concluida: false }
    render(<TarefaForm plantioOpcoes={plantioOpcoes} tarefa={tarefa} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Descrição')).toHaveValue('Tarefa existente')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<TarefaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { descricao: ['Descricao muito longa.'] })
    render(<TarefaForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Descricao muito longa.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<TarefaForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TarefaForm.test.tsx`
Expected: FAIL — `Failed to resolve import "./TarefaForm"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/TarefaForm.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/TarefaForm.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TarefaForm.tsx frontend/src/components/TarefaForm.test.tsx
git commit -m "feat(tasks): adicionar TarefaForm com criar/editar"
```

---

### Task 4: `TarefaItem` — shared checkbox+text presentational component

**Files:**
- Create: `frontend/src/components/TarefaItem.tsx`
- Create: `frontend/src/components/TarefaItem.test.tsx`

**Interfaces:**
- Consumes: `Tarefa` from `../api/tarefas` (Task 2).
- Produces: `TarefaItem(props: {tarefa: Tarefa; rotulo?: string; atrasada: boolean; onToggleConcluida: (concluida: boolean) => void})`. No internal state, no API calls — purely presentational. Tasks 5 (`TarefasPage`) and 6 (`DashboardPage`) both consume this; `TarefasPage` always passes `rotulo` (the plantio label, since its list isn't grouped by talhão); `DashboardPage` omits `rotulo` (the talhão is already shown as the group heading, so repeating it per-item would be redundant).

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/components/TarefaItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TarefaItem } from './TarefaItem'

const tarefaPendente = { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }
const tarefaConcluida = { id: 2, plantio: 1, descricao: 'Adubar', data: '2026-08-01', concluida: true }

describe('TarefaItem', () => {
  it('renderiza descricao e data formatada', () => {
    render(<TarefaItem tarefa={tarefaPendente} atrasada={false} onToggleConcluida={vi.fn()} />)

    expect(screen.getByText(/Regar/)).toBeInTheDocument()
    expect(screen.getByText(/05\/08\/2026/)).toBeInTheDocument()
  })

  it('renderiza o rotulo quando fornecido', () => {
    render(
      <TarefaItem tarefa={tarefaPendente} rotulo="Tomate — Talhao 1" atrasada={false} onToggleConcluida={vi.fn()} />,
    )

    expect(screen.getByText(/Tomate — Talhao 1/)).toBeInTheDocument()
  })

  it('checkbox reflete tarefa.concluida', () => {
    render(<TarefaItem tarefa={tarefaConcluida} atrasada={false} onToggleConcluida={vi.fn()} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('clicar no checkbox chama onToggleConcluida com o valor invertido', async () => {
    const onToggleConcluida = vi.fn()
    render(<TarefaItem tarefa={tarefaPendente} atrasada={false} onToggleConcluida={onToggleConcluida} />)

    await userEvent.click(screen.getByRole('checkbox'))

    expect(onToggleConcluida).toHaveBeenCalledWith(true)
  })

  it('tarefa atrasada recebe classe de destaque', () => {
    render(<TarefaItem tarefa={tarefaPendente} atrasada={true} onToggleConcluida={vi.fn()} />)

    expect(screen.getByText(/Regar/).className).toContain('text-red-600')
  })

  it('tarefa concluida recebe estilo riscado, nao vermelho', () => {
    render(<TarefaItem tarefa={tarefaConcluida} atrasada={false} onToggleConcluida={vi.fn()} />)

    expect(screen.getByText(/Adubar/).className).toContain('line-through')
    expect(screen.getByText(/Adubar/).className).not.toContain('text-red-600')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TarefaItem.test.tsx`
Expected: FAIL — `Failed to resolve import "./TarefaItem"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/TarefaItem.tsx`:

```tsx
import type { Tarefa } from '../api/tarefas'

type TarefaItemProps = {
  tarefa: Tarefa
  rotulo?: string
  atrasada: boolean
  onToggleConcluida: (concluida: boolean) => void
}

export function TarefaItem({ tarefa, rotulo, atrasada, onToggleConcluida }: TarefaItemProps) {
  const dataFormatada = new Date(`${tarefa.data}T00:00:00`).toLocaleDateString('pt-BR')
  const classeTexto = atrasada ? 'text-red-600' : tarefa.concluida ? 'text-gray-400 line-through' : ''

  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={tarefa.concluida}
        onChange={(e) => onToggleConcluida(e.target.checked)}
      />
      <span className={classeTexto}>
        {tarefa.descricao}
        {rotulo && ` — ${rotulo}`} — {dataFormatada}
      </span>
    </label>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/TarefaItem.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TarefaItem.tsx frontend/src/components/TarefaItem.test.tsx
git commit -m "feat(tasks): adicionar TarefaItem compartilhado entre TarefasPage e DashboardPage"
```

---

### Task 5: `TarefasPage` — list + create/edit/delete + mark-done checkbox

**Files:**
- Create: `frontend/src/pages/TarefasPage.tsx`
- Create: `frontend/src/pages/TarefasPage.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2, 3, 4 (`api/tarefas.ts`, `TarefaForm`, `TarefaItem`); `listarPlantios` from `../api/plantios`; `listarTalhoes` from `../api/talhoes`; `listarCulturas` from `../api/culturas`; `ConfirmDialog` from `../components/ConfirmDialog`.
- Produces: `TarefasPage()` component. Task 7 (routing) wires this to `/tarefas`.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/pages/TarefasPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TarefasPage } from './TarefasPage'
import * as tarefasApi from '../api/tarefas'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'
import { ApiError } from '../lib/api-client'

vi.mock('../api/tarefas')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90 }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TarefasPage />
    </QueryClientProvider>,
  )
}

describe('TarefasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lista por padrao so tarefas pendentes', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false },
      { id: 2, plantio: 1, descricao: 'Ja feita', data: '2026-08-01', concluida: true },
    ])

    renderComProvider()

    expect(await screen.findByText(/Regar/)).toBeInTheDocument()
    expect(screen.queryByText(/Ja feita/)).not.toBeInTheDocument()
  })

  it('"Ver concluidas" revela as tarefas concluidas', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false },
      { id: 2, plantio: 1, descricao: 'Ja feita', data: '2026-08-01', concluida: true },
    ])

    renderComProvider()
    await screen.findByText(/Regar/)

    await userEvent.click(screen.getByText('Ver concluídas'))

    expect(await screen.findByText(/Ja feita/)).toBeInTheDocument()
  })

  it('criar tarefa via formulario adiciona o item a lista', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Nova tarefa', data: '2026-08-06', concluida: false }])
    vi.mocked(tarefasApi.criarTarefa).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Nova tarefa',
      data: '2026-08-06',
      concluida: false,
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Tarefa'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Descrição'), 'Nova tarefa')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-06')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Nova tarefa/)).toBeInTheDocument()
  })

  it('editar uma tarefa existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Descricao antiga', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Descricao nova', data: '2026-08-05', concluida: false }])
    vi.mocked(tarefasApi.atualizarTarefa).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Descricao nova',
      data: '2026-08-05',
      concluida: false,
    })

    renderComProvider()
    await screen.findByText(/Descricao antiga/)
    await userEvent.click(screen.getByText('Editar'))

    expect(screen.getByLabelText('Descrição')).toHaveValue('Descricao antiga')

    await userEvent.clear(screen.getByLabelText('Descrição'))
    await userEvent.type(screen.getByLabelText('Descrição'), 'Descricao nova')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Descricao nova/)).toBeInTheDocument()
  })

  it('excluir tarefa remove o item da lista', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([])
    vi.mocked(tarefasApi.excluirTarefa).mockResolvedValue(undefined)

    renderComProvider()
    await screen.findByText(/Regar/)
    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(screen.queryByText(/Regar/)).not.toBeInTheDocument()
  })

  it('clicar no checkbox marca como concluida e a tarefa some da lista de pendentes', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: true }])
    vi.mocked(tarefasApi.alterarConclusao).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Regar',
      data: '2026-08-05',
      concluida: true,
    })

    renderComProvider()
    await screen.findByText(/Regar/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(vi.mocked(tarefasApi.alterarConclusao)).toHaveBeenCalledWith(1, true)
    expect(screen.queryByText(/Regar/)).not.toBeInTheDocument()
  })

  it('erro ao marcar conclusao aparece como mensagem inline', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar', data: '2026-08-05', concluida: false },
    ])
    vi.mocked(tarefasApi.alterarConclusao).mockRejectedValue(new ApiError(500, 'Erro interno do servidor.', {}))

    renderComProvider()
    await screen.findByText(/Regar/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })

  it('tarefa atrasada aparece com destaque visual', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Atrasada', data: '2026-08-01', concluida: false },
    ])

    renderComProvider()

    expect((await screen.findByText(/Atrasada/)).className).toContain('text-red-600')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/TarefasPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./TarefasPage"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/pages/TarefasPage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarTarefas,
  criarTarefa,
  atualizarTarefa,
  excluirTarefa,
  alterarConclusao,
  type Tarefa,
  type TarefaInput,
} from '../api/tarefas'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TarefaForm } from '../components/TarefaForm'
import { TarefaItem } from '../components/TarefaItem'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; tarefa: Tarefa } | null

function paraApiError(erro: unknown): ApiError {
  return erro instanceof ApiError ? erro : new ApiError(0, 'Erro inesperado.')
}

// new Date().toISOString() usa UTC e pode adiantar/atrasar um dia perto da meia-noite
// dependendo do fuso local — usamos os componentes locais da data pra montar o
// "hoje" que compara com o campo `data` (YYYY-MM-DD) das tarefas.
function hojeISO(): string {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function TarefasPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Tarefa | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [erroConclusao, setErroConclusao] = useState<string | null>(null)
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false)

  const tarefasQuery = useQuery({ queryKey: ['tarefas'], queryFn: listarTarefas })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarTarefa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: TarefaInput }) => atualizarTarefa(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirTarefa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  const concluirMutation = useMutation({
    mutationFn: ({ id, concluida }: { id: number; concluida: boolean }) => alterarConclusao(id, concluida),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroConclusao(null)
    },
    onError: (erro) => setErroConclusao(paraApiError(erro).message),
  })

  if (tarefasQuery.isLoading || plantiosQuery.isLoading || talhoesQuery.isLoading || culturasQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (tarefasQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as tarefas.</p>
        <button onClick={() => tarefasQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const tarefas = tarefasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  function nomeTalhao(id: number): string {
    return talhoes.find((t) => t.id === id)?.nome ?? '—'
  }
  function nomeCultura(id: number): string {
    return culturas.find((c) => c.id === id)?.nome ?? '—'
  }
  function labelPlantio(plantioId: number): string {
    const plantio = plantios.find((p) => p.id === plantioId)
    if (!plantio) return '—'
    const dataFormatada = new Date(`${plantio.data_plantio}T00:00:00`).toLocaleDateString('pt-BR')
    return `${nomeCultura(plantio.cultura)} — ${nomeTalhao(plantio.talhao)} — ${dataFormatada}`
  }

  const plantioOpcoes = plantios.map((plantio) => ({ id: plantio.id, label: labelPlantio(plantio.id) }))
  const hoje = hojeISO()
  const tarefasVisiveis = (mostrarConcluidas ? tarefas : tarefas.filter((t) => !t.concluida))
    .slice()
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Tarefas</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Tarefa
        </button>
      </div>

      <button onClick={() => setMostrarConcluidas((v) => !v)} className="mb-4 text-sm underline">
        {mostrarConcluidas ? 'Ocultar concluídas' : 'Ver concluídas'}
      </button>

      {erroConclusao && <p className="mb-2 text-sm text-red-600">{erroConclusao}</p>}

      {formulario?.tipo === 'novo' && (
        <TarefaForm
          plantioOpcoes={plantioOpcoes}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {tarefasVisiveis.map((tarefa) =>
          formulario?.tipo === 'editar' && formulario.tarefa.id === tarefa.id ? (
            <li key={tarefa.id} className="mb-2 border p-2">
              <TarefaForm
                plantioOpcoes={plantioOpcoes}
                tarefa={tarefa}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: tarefa.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={tarefa.id} className="mb-2 flex items-center justify-between border p-2">
              <TarefaItem
                tarefa={tarefa}
                rotulo={labelPlantio(tarefa.plantio)}
                atrasada={!tarefa.concluida && tarefa.data < hoje}
                onToggleConcluida={(concluida) => {
                  setErroConclusao(null)
                  concluirMutation.mutate({ id: tarefa.id, concluida })
                }}
              />
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', tarefa })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(tarefa)
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
        titulo="Excluir tarefa"
        mensagem="Tem certeza que deseja excluir esta tarefa?"
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

Run: `cd frontend && npx vitest run src/pages/TarefasPage.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TarefasPage.tsx frontend/src/pages/TarefasPage.test.tsx
git commit -m "feat(tasks): adicionar TarefasPage (criar, editar, excluir, marcar concluida)"
```

---

### Task 6: `DashboardPage` — RF12 panel, grouped by talhão

**Files:**
- Modify (full rewrite): `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/pages/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `listarTarefas`, `alterarConclusao` from `../api/tarefas` (Task 2); `TarefaItem` from `../components/TarefaItem` (Task 4); `listarPlantios` from `../api/plantios`; `listarTalhoes` from `../api/talhoes`; `useAuth` from `../auth/AuthContext` (existing, for the "Bem-vindo" greeting already there).
- Produces: `DashboardPage()` component, same export name and no-props signature as before — `routes.tsx` already wires this to `/`, no routing change needed for this task.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/pages/DashboardPage.test.tsx`. Note this test mocks `useAuth` since `DashboardPage` reads `usuario` from it directly (not via a provider in this test, following the existing pattern of testing pages in isolation):

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from './DashboardPage'
import * as tarefasApi from '../api/tarefas'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as authContext from '../auth/AuthContext'
import { ApiError } from '../lib/api-client'

vi.mock('../api/tarefas')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../auth/AuthContext')

const plantioTalhao1 = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const plantioTalhao2 = { id: 2, talhao: 2, cultura: 1, data_plantio: '2026-07-01', status: 'em_andamento' as const }
const talhao1 = { id: 1, propriedade: 1, nome: 'Talhao A', area: '1.00', tipo_solo: 'argiloso' }
const talhao2 = { id: 2, propriedade: 1, nome: 'Talhao B', area: '1.00', tipo_solo: 'arenoso' }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: { id: 1, username: 'produtor1' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantioTalhao1, plantioTalhao2])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao1, talhao2])
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra a saudacao com o nome do usuario', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText(/Bem-vindo, produtor1/)).toBeInTheDocument()
  })

  it('agrupa tarefas pendentes por talhao', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false },
      { id: 2, plantio: 2, descricao: 'Regar B', data: '2026-08-05', concluida: false },
    ])

    renderComProvider()

    expect(await screen.findByText('Talhao A')).toBeInTheDocument()
    expect(screen.getByText('Talhao B')).toBeInTheDocument()
    expect(screen.getByText(/Regar A/)).toBeInTheDocument()
    expect(screen.getByText(/Regar B/)).toBeInTheDocument()
  })

  it('talhao sem tarefa pendente nao aparece', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false },
    ])

    renderComProvider()

    await screen.findByText('Talhao A')
    expect(screen.queryByText('Talhao B')).not.toBeInTheDocument()
  })

  it('tarefa concluida nao aparece no painel', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Ja feita', data: '2026-08-01', concluida: true },
    ])

    renderComProvider()

    await screen.findByText(/Bem-vindo/)
    expect(screen.queryByText(/Ja feita/)).not.toBeInTheDocument()
  })

  it('nenhuma tarefa pendente mostra mensagem vazia', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText('Nenhuma tarefa pendente.')).toBeInTheDocument()
  })

  it('tarefa atrasada aparece com destaque visual', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Atrasada', data: '2026-08-01', concluida: false },
    ])

    renderComProvider()

    expect((await screen.findByText(/Atrasada/)).className).toContain('text-red-600')
  })

  it('checkbox no painel marca tarefa como concluida', async () => {
    vi.mocked(tarefasApi.listarTarefas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false }])
      .mockResolvedValueOnce([])
    vi.mocked(tarefasApi.alterarConclusao).mockResolvedValue({
      id: 1,
      plantio: 1,
      descricao: 'Regar A',
      data: '2026-08-05',
      concluida: true,
    })

    renderComProvider()
    await screen.findByText(/Regar A/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(vi.mocked(tarefasApi.alterarConclusao)).toHaveBeenCalledWith(1, true)
  })

  it('erro ao marcar conclusao aparece como mensagem inline', async () => {
    vi.mocked(tarefasApi.listarTarefas).mockResolvedValue([
      { id: 1, plantio: 1, descricao: 'Regar A', data: '2026-08-05', concluida: false },
    ])
    vi.mocked(tarefasApi.alterarConclusao).mockRejectedValue(new ApiError(500, 'Erro interno do servidor.', {}))

    renderComProvider()
    await screen.findByText(/Regar A/)
    await userEvent.click(screen.getByRole('checkbox'))

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/DashboardPage.test.tsx`
Expected: FAIL — the current `DashboardPage` doesn't query tarefas/plantios/talhoes, doesn't group by talhão, and `useAuth` isn't mocked as an object with `login`/`logout`, so most assertions fail (no "Talhao A" text, no checkbox, etc).

- [ ] **Step 3: Write the implementation**

Rewrite `frontend/src/pages/DashboardPage.tsx` completely:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { listarTarefas, alterarConclusao, type Tarefa } from '../api/tarefas'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { ApiError } from '../lib/api-client'
import { TarefaItem } from '../components/TarefaItem'

function paraApiError(erro: unknown): ApiError {
  return erro instanceof ApiError ? erro : new ApiError(0, 'Erro inesperado.')
}

// Mesmo cuidado de TarefasPage.tsx: monta "hoje" a partir dos componentes locais
// da data, nao de new Date().toISOString() (que e UTC).
function hojeISO(): string {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function DashboardPage() {
  const { usuario } = useAuth()
  const queryClient = useQueryClient()
  const [erroConclusao, setErroConclusao] = useState<string | null>(null)

  const tarefasQuery = useQuery({ queryKey: ['tarefas'], queryFn: listarTarefas })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })

  const concluirMutation = useMutation({
    mutationFn: ({ id, concluida }: { id: number; concluida: boolean }) => alterarConclusao(id, concluida),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas'] })
      setErroConclusao(null)
    },
    onError: (erro) => setErroConclusao(paraApiError(erro).message),
  })

  if (tarefasQuery.isLoading || plantiosQuery.isLoading || talhoesQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (tarefasQuery.isError || plantiosQuery.isError || talhoesQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar o painel.</p>
        <button onClick={() => tarefasQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const tarefas = tarefasQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const hoje = hojeISO()

  function nomeTalhaoDoPlantio(plantioId: number): string {
    const plantio = plantios.find((p) => p.id === plantioId)
    if (!plantio) return '—'
    return talhoes.find((t) => t.id === plantio.talhao)?.nome ?? '—'
  }

  const pendentes = tarefas.filter((t) => !t.concluida)
  const gruposPorTalhao = new Map<string, Tarefa[]>()
  for (const tarefa of pendentes) {
    const nomeTalhao = nomeTalhaoDoPlantio(tarefa.plantio)
    const grupo = gruposPorTalhao.get(nomeTalhao) ?? []
    grupo.push(tarefa)
    gruposPorTalhao.set(nomeTalhao, grupo)
  }
  const talhoesOrdenados = [...gruposPorTalhao.keys()].sort((a, b) => a.localeCompare(b))

  return (
    <div>
      <p className="mb-4">Bem-vindo, {usuario?.username}</p>

      {erroConclusao && <p className="mb-2 text-sm text-red-600">{erroConclusao}</p>}

      {talhoesOrdenados.length === 0 && <p>Nenhuma tarefa pendente.</p>}

      {talhoesOrdenados.map((nomeTalhao) => {
        const tarefasDoTalhao = [...(gruposPorTalhao.get(nomeTalhao) ?? [])].sort((a, b) =>
          a.data < b.data ? -1 : a.data > b.data ? 1 : 0,
        )
        return (
          <div key={nomeTalhao} className="mb-4">
            <h2 className="mb-2 font-bold">{nomeTalhao}</h2>
            <ul>
              {tarefasDoTalhao.map((tarefa) => (
                <li key={tarefa.id} className="mb-1">
                  <TarefaItem
                    tarefa={tarefa}
                    atrasada={tarefa.data < hoje}
                    onToggleConcluida={(concluida) => {
                      setErroConclusao(null)
                      concluirMutation.mutate({ id: tarefa.id, concluida })
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/DashboardPage.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/DashboardPage.test.tsx
git commit -m "feat(tasks): reescrever DashboardPage como painel RF12 agrupado por talhao"
```

---

### Task 7: Routing and navigation

**Files:**
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/layout/AppShell.tsx`
- Modify: `frontend/src/routes.test.tsx`

**Interfaces:**
- Consumes: `TarefasPage` from `../pages/TarefasPage` (Task 5).

- [ ] **Step 1: Write the failing test — append to `routes.test.tsx`**

In `frontend/src/routes.test.tsx`, inside the existing `describe('navegacao para as paginas de cadastro', ...)` block (after the "Aplicacoes" test, before the closing `})` of that `describe`), add:

```tsx
  it('link de Tarefas navega para a pagina de tarefas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // TarefasPage dispara 4 fetches paralelos (tarefas/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Tarefas' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tarefas' })).toBeInTheDocument())
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: FAIL — no link named "Tarefas" exists yet in `AppShell`.

- [ ] **Step 3: Add the route**

In `frontend/src/routes.tsx`, add the import (after the `AplicacoesPage` import):

```ts
import { TarefasPage } from './pages/TarefasPage'
```

Add the route object (after the `/aplicacoes` route, before the `{ path: '*', ... }` catch-all):

```tsx
  {
    path: '/tarefas',
    element: (
      <ProtectedRoute>
        <AppShell>
          <TarefasPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
```

- [ ] **Step 4: Add the nav link**

In `frontend/src/layout/AppShell.tsx`, add a link after the "Aplicações" link (line 19):

```tsx
            <Link to="/tarefas">Tarefas</Link>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, all test files green.

- [ ] **Step 7: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes.tsx frontend/src/layout/AppShell.tsx frontend/src/routes.test.tsx
git commit -m "feat(frontend): adicionar rota e navegacao para tarefas"
```

---

## Post-plan: whole-branch review

After all 7 tasks are committed, run the final whole-branch review (per `superpowers:subagent-driven-development`) covering the full diff against `master`, with special attention to:

- Every mutation (create/update/delete/mark-done) across `TarefasPage` and `DashboardPage` has an `onError` — this fatia's Global Constraints explicitly calls this out given the 3a review's finding.
- `useMapeamentoErroFormulario` behaves identically to the inline code it replaced in `InsumoForm`/`AplicacaoInsumoForm` (their existing test suites are the check — they were not modified).
- The "atrasada" (overdue) computation is consistent between `TarefasPage` and `DashboardPage` and uses local date components, not UTC.
- `TarefaItem`'s optional `rotulo` is used correctly: present in `TarefasPage`, omitted in `DashboardPage`.
