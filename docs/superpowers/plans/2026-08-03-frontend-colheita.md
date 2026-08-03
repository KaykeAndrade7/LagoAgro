# Frontend: colheita (Task #8, fatia 4a/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/colheitas` page with full CRUD for `Colheita` (RF09), plus RF07 (data segura de colheita) shown informationally when creating/editing a colheita.

**Architecture:** One new Django `@action` on the existing `PlantioViewSet` exposing the already-tested `domain/safety_calc.py` pure function; a thin `api/colheitas.ts` wrapper plus one addition to the existing `api/plantios.ts`; a `ColheitaForm` that — for the first time in this codebase — runs its own `useQuery` (not just props from the page) because the "data segura" value is intrinsically tied to the live value of its own `plantio` field; a `ColheitasPage` following the established list+create/edit/delete pattern.

**Tech Stack:** Django REST Framework, React 19 + TypeScript, react-hook-form + zod, TanStack Query, Vitest + React Testing Library.

## Global Constraints

- Backend contract (confirmed in `lagoagro/harvest/`): `ColheitaSerializer` = `{id, plantio, data, classificacao, quantidade}`. `classificacao` is `"primeira" | "segunda"`. `quantidade` is a `DecimalField`, serializes as a **string** (same as `Talhao.area`, `AplicacaoInsumo.quantidade`). `Colheita.plantio` is `on_delete=CASCADE` — **not** a `PROTECT`/audit-trail entity like `AplicacaoInsumo`/`LancamentoFinanceiro`. Full CRUD including edit and delete, no pre-check needed before deleting.
- New endpoint: `GET /api/plantios/{id}/data-segura-colheita/` → `{"data_segura": "YYYY-MM-DD" | null}`. It's a `@action` on the existing `PlantioViewSet`, so it inherits `UsuarioScopedQuerySetMixin` scoping automatically via `self.get_object()` — a plantio ID belonging to another user returns 404, same as every other detail route on this viewset.
- `domain/safety_calc.py:data_segura_colheita(aplicacoes)` is an existing, already-tested pure function (`aplicacoes: list[{"data": date, "carencia_dias": int}]` → `date | None`) — do not modify it, just call it.
- The "data segura" display in `ColheitaForm` is purely informational — it must NEVER block form submission, regardless of its value (matches the project's established "no automatic enforcement" convention for RF06/RF07).
- `paraApiError` lives in `frontend/src/lib/api-client.ts` (extracted during fatia 3c's final review) — import it from there, do not redefine it locally in any new file.
- `z.coerce.number()` on the `plantio` select field requires the 3-generic `useForm<Input, Context, Values>` signature (see `PlantioForm.tsx`/`TarefaForm.tsx` for the established pattern and its rationale) — never a single-generic `useForm` with a coerced field.
- `npx tsc -b` must run clean (`cd frontend && npx tsc -b`) before any task is reported done. Backend tests run via the project venv, NOT `python`/`pytest` on PATH: `"<repo-root>/lagoagro/.venv/Scripts/python.exe" -m pytest` from `lagoagro/` (confirmed working from inside a worktree in fatia 3c — the venv is shared with the main checkout and gitignored, so it must be referenced by its full path, never assumed to exist inside a fresh worktree).
- Every mutation must have an `onError` (established rule since the 3a/3b final reviews caught missing-`onError` bugs). "Tentar novamente" buttons must refetch ALL of the page's queries, not just the primary one (established rule since the 3b final review).
- Tests: Vitest + React Testing Library + `@testing-library/user-event`; API-layer tests mock `fetch`; page/integration tests mock `api/*` modules via `vi.mock`.

---

### Task 1: Backend — `data-segura-colheita` action on `PlantioViewSet`

**Files:**
- Modify: `lagoagro/plantings/views.py`
- Modify: `lagoagro/tests/test_plantings_views.py`

**Interfaces:**
- Produces: `GET /api/plantios/{id}/data-segura-colheita/` → `200 {"data_segura": str | null}`. Task 3 (frontend `api/plantios.ts`) consumes this via its URL string only.

- [ ] **Step 1: Write the failing tests**

Add these two imports to the top of `lagoagro/tests/test_plantings_views.py` (alongside the existing `from decimal import Decimal` / `from django.contrib.auth import get_user_model` / etc.):

```python
from datetime import date

from inputs.models import AplicacaoInsumo, Insumo
```

Then append these tests to the file:

```python
def test_data_segura_colheita_sem_aplicacoes_retorna_null(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    response = client.get(f"/api/plantios/{plantio.id}/data-segura-colheita/")

    assert response.status_code == 200
    assert response.data["data_segura"] is None


def test_data_segura_colheita_usa_a_maior_data_entre_aplicacoes(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    inseticida = Insumo.objects.create(usuario=usuario, nome="Inseticida", tipo="veneno", carencia_dias=7)
    adubo = Insumo.objects.create(usuario=usuario, nome="Adubo", tipo="adubo", carencia_dias=1)
    AplicacaoInsumo.objects.create(plantio=plantio, insumo=inseticida, data=date(2026, 1, 10), quantidade=Decimal("1.00"))
    AplicacaoInsumo.objects.create(plantio=plantio, insumo=adubo, data=date(2026, 1, 15), quantidade=Decimal("1.00"))

    response = client.get(f"/api/plantios/{plantio.id}/data-segura-colheita/")

    assert response.status_code == 200
    assert response.data["data_segura"] == "2026-01-17"  # 2026-01-10 + 7 dias > 2026-01-15 + 1 dia


def test_data_segura_colheita_de_plantio_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio_outro = Plantio.objects.create(talhao=talhao_outro, cultura=cultura, data_plantio="2026-01-01")

    response = client.get(f"/api/plantios/{plantio_outro.id}/data-segura-colheita/")

    assert response.status_code == 404
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `lagoagro/`): `"C:\Users\Kayke Andrade\Desktop\LagoAgro\lagoagro\.venv\Scripts\python.exe" -m pytest tests/test_plantings_views.py -k data_segura -v`
Expected: FAIL — `404 Not Found` (the action route doesn't exist yet).

- [ ] **Step 3: Add the action**

Replace the full contents of `lagoagro/plantings/views.py`:

```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import UsuarioScopedQuerySetMixin
from domain.safety_calc import data_segura_colheita
from inputs.models import AplicacaoInsumo

from .models import Plantio
from .serializers import PlantioSerializer


class PlantioViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Plantio.objects.all()
    serializer_class = PlantioSerializer
    usuario_lookup = "talhao__propriedade__usuario"

    @action(detail=True, methods=["get"], url_path="data-segura-colheita")
    def data_segura_colheita_view(self, request, pk=None):
        plantio = self.get_object()
        aplicacoes = [
            {"data": a.data, "carencia_dias": a.insumo.carencia_dias}
            for a in AplicacaoInsumo.objects.filter(plantio=plantio).select_related("insumo")
        ]
        data_segura = data_segura_colheita(aplicacoes)
        return Response({"data_segura": data_segura.isoformat() if data_segura else None})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `"C:\Users\Kayke Andrade\Desktop\LagoAgro\lagoagro\.venv\Scripts\python.exe" -m pytest tests/test_plantings_views.py -k data_segura -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full backend suite**

Run: `"C:\Users\Kayke Andrade\Desktop\LagoAgro\lagoagro\.venv\Scripts\python.exe" -m pytest`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lagoagro/plantings/views.py lagoagro/tests/test_plantings_views.py
git commit -m "feat(plantings): adicionar endpoint de data segura de colheita (RF07)"
```

---

### Task 2: `api/colheitas.ts` — API layer

**Files:**
- Create: `frontend/src/api/colheitas.ts`
- Create: `frontend/src/api/colheitas.test.ts`

**Interfaces:**
- Produces: `type ClassificacaoColheita = 'primeira' | 'segunda'`, `type Colheita = {id: number; plantio: number; data: string; classificacao: ClassificacaoColheita; quantidade: string}`, `type ColheitaInput = {plantio: number; data: string; classificacao: ClassificacaoColheita; quantidade: string}`, `ROTULOS_CLASSIFICACAO: Record<ClassificacaoColheita, string>`, `listarColheitas`, `criarColheita`, `atualizarColheita`, `excluirColheita`. Tasks 4 and 5 consume these.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/api/colheitas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarColheitas, criarColheita, atualizarColheita, excluirColheita } from './colheitas'

describe('api/colheitas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const colheita = { id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira' as const, quantidade: '10.00' }

  it('listarColheitas faz GET /api/colheitas/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([colheita]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarColheitas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([colheita])
  })

  it('criarColheita faz POST /api/colheitas/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(colheita), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, data: '2026-08-05', classificacao: 'primeira' as const, quantidade: '10.00' }
    const result = await criarColheita(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(colheita)
  })

  it('atualizarColheita faz PATCH /api/colheitas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(colheita), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarColheita(1, { plantio: 1, data: '2026-08-05', classificacao: 'segunda', quantidade: '5.00' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirColheita faz DELETE /api/colheitas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirColheita(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/colheitas/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/colheitas.test.ts`
Expected: FAIL — `Failed to resolve import "./colheitas"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/api/colheitas.ts`:

```ts
import { apiRequest } from '../lib/api-client'

export type ClassificacaoColheita = 'primeira' | 'segunda'

export type Colheita = {
  id: number
  plantio: number
  data: string
  classificacao: ClassificacaoColheita
  quantidade: string
}

export type ColheitaInput = {
  plantio: number
  data: string
  classificacao: ClassificacaoColheita
  quantidade: string
}

export const ROTULOS_CLASSIFICACAO: Record<ClassificacaoColheita, string> = {
  primeira: 'Primeira',
  segunda: 'Segunda',
}

export function listarColheitas(): Promise<Colheita[]> {
  return apiRequest<Colheita[]>('/colheitas/')
}

export function criarColheita(input: ColheitaInput): Promise<Colheita> {
  return apiRequest<Colheita>('/colheitas/', { method: 'POST', body: input })
}

export function atualizarColheita(id: number, input: ColheitaInput): Promise<Colheita> {
  return apiRequest<Colheita>(`/colheitas/${id}/`, { method: 'PATCH', body: input })
}

export function excluirColheita(id: number): Promise<void> {
  return apiRequest<void>(`/colheitas/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/colheitas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/colheitas.ts frontend/src/api/colheitas.test.ts
git commit -m "feat(harvest): adicionar api layer de colheitas no frontend"
```

---

### Task 3: `api/plantios.ts` — add `obterDataSeguraColheita`

**Files:**
- Modify: `frontend/src/api/plantios.ts`
- Modify: `frontend/src/api/plantios.test.ts`

**Interfaces:**
- Produces: `obterDataSeguraColheita(plantioId: number): Promise<{data_segura: string | null}>`. Task 4 (`ColheitaForm`) consumes this.

- [ ] **Step 1: Write the failing test**

Add this test to the end of the `describe('api/plantios', ...)` block in `frontend/src/api/plantios.test.ts` (no new imports needed beyond adding `obterDataSeguraColheita` to the existing import line):

```ts
  it('obterDataSeguraColheita faz GET /api/plantios/:id/data-segura-colheita/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data_segura: '2026-08-10' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await obterDataSeguraColheita(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/1/data-segura-colheita/')
    expect(options.method).toBe('GET')
    expect(result).toEqual({ data_segura: '2026-08-10' })
  })
```

Change the top import line from:
```ts
import { listarPlantios, criarPlantio, atualizarPlantio, excluirPlantio } from './plantios'
```
to:
```ts
import { listarPlantios, criarPlantio, atualizarPlantio, excluirPlantio, obterDataSeguraColheita } from './plantios'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/plantios.test.ts`
Expected: FAIL — `obterDataSeguraColheita` is not exported.

- [ ] **Step 3: Add the function**

In `frontend/src/api/plantios.ts`, add this function at the end of the file:

```ts
export function obterDataSeguraColheita(plantioId: number): Promise<{ data_segura: string | null }> {
  return apiRequest<{ data_segura: string | null }>(`/plantios/${plantioId}/data-segura-colheita/`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/plantios.test.ts`
Expected: PASS (5 tests, the 4 pre-existing plus the new one).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/plantios.ts frontend/src/api/plantios.test.ts
git commit -m "feat(plantings): adicionar obterDataSeguraColheita no frontend"
```

---

### Task 4: `ColheitaForm` — create/edit form with live "data segura" lookup

**Files:**
- Create: `frontend/src/components/ColheitaForm.tsx`
- Create: `frontend/src/components/ColheitaForm.test.tsx`

**Interfaces:**
- Consumes: `Colheita`, `ColheitaInput`, `ROTULOS_CLASSIFICACAO`, `ClassificacaoColheita` from `../api/colheitas` (Task 2); `obterDataSeguraColheita` from `../api/plantios` (Task 3); `type PlantioOpcao` — already exported from `frontend/src/components/AplicacaoInsumoForm.tsx:9`; `useMapeamentoErroFormulario` from `../lib/mutation-errors`; `ApiError` from `../lib/api-client`.
- Produces: `ColheitaForm(props: {plantioOpcoes: PlantioOpcao[]; colheita?: Colheita; erro?: ApiError | null; onSubmit: (input: ColheitaInput) => void; onCancel: () => void})`. Task 5 (`ColheitasPage`) consumes this.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/components/ColheitaForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ColheitaForm } from './ColheitaForm'
import * as plantiosApi from '../api/plantios'
import { ApiError } from '../lib/api-client'

vi.mock('../api/plantios')

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]

function renderComProvider(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ColheitaForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.obterDataSeguraColheita).mockResolvedValue({ data_segura: null })
  })

  it('popula o select de plantio a partir das props', () => {
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores preenchidos', async () => {
    const onSubmit = vi.fn()
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.selectOptions(screen.getByLabelText('Classificação'), 'segunda')
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '10')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      plantio: 1,
      data: '2026-08-05',
      classificacao: 'segunda',
      quantidade: '10',
    })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '10')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('busca e exibe a data segura ao selecionar um plantio', async () => {
    vi.mocked(plantiosApi.obterDataSeguraColheita).mockResolvedValue({ data_segura: '2026-08-10' })
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')

    expect(await screen.findByText('Data segura para colher: 10/08/2026')).toBeInTheDocument()
  })

  it('mostra mensagem de sem restricao quando a data segura vem nula', async () => {
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')

    expect(
      await screen.findByText('Nenhuma restrição de carência para este plantio.'),
    ).toBeInTheDocument()
  })

  it('pre-popula os campos quando editando uma colheita existente', () => {
    const colheita = { id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira' as const, quantidade: '5.00' }
    renderComProvider(
      <ColheitaForm plantioOpcoes={plantioOpcoes} colheita={colheita} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Plantio')).toHaveValue('1')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-05')
    expect(screen.getByLabelText('Quantidade (caixas)')).toHaveValue('5.00')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { quantidade: ['Quantidade invalida.'] })
    renderComProvider(<ColheitaForm plantioOpcoes={plantioOpcoes} erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Quantidade invalida.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/ColheitaForm.test.tsx`
Expected: FAIL — `Failed to resolve import "./ColheitaForm"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/ColheitaForm.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/ColheitaForm.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ColheitaForm.tsx frontend/src/components/ColheitaForm.test.tsx
git commit -m "feat(harvest): adicionar ColheitaForm com data segura de colheita (RF07)"
```

---

### Task 5: `ColheitasPage` — list + create/edit/delete

**Files:**
- Create: `frontend/src/pages/ColheitasPage.tsx`
- Create: `frontend/src/pages/ColheitasPage.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2, 3, 4 (`api/colheitas.ts`, `ColheitaForm`); `listarPlantios` from `../api/plantios`; `listarTalhoes` from `../api/talhoes`; `listarCulturas` from `../api/culturas`; `ApiError`, `paraApiError` from `../lib/api-client`; `ConfirmDialog` from `../components/ConfirmDialog`.
- Produces: `ColheitasPage()`. Task 6 (routing) wires this to `/colheitas`.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/pages/ColheitasPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ColheitasPage } from './ColheitasPage'
import * as colheitasApi from '../api/colheitas'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/colheitas')
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
      <ColheitasPage />
    </QueryClientProvider>,
  )
}

describe('ColheitasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
    vi.mocked(plantiosApi.obterDataSeguraColheita).mockResolvedValue({ data_segura: null })
  })

  it('lista carrega e renderiza as colheitas', async () => {
    vi.mocked(colheitasApi.listarColheitas).mockResolvedValue([
      { id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '10.00' },
    ])

    renderComProvider()

    expect(await screen.findByText(/Primeira/)).toBeInTheDocument()
  })

  it('criar colheita via formulario adiciona o item a lista', async () => {
    vi.mocked(colheitasApi.listarColheitas)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'segunda', quantidade: '3.00' }])
    vi.mocked(colheitasApi.criarColheita).mockResolvedValue({
      id: 1,
      plantio: 1,
      data: '2026-08-05',
      classificacao: 'segunda',
      quantidade: '3.00',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Colheita'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.type(screen.getByLabelText('Data'), '2026-08-05')
    await userEvent.selectOptions(screen.getByLabelText('Classificação'), 'segunda')
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '3')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Segunda/)).toBeInTheDocument()
  })

  it('editar uma colheita existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    vi.mocked(colheitasApi.listarColheitas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '10.00' }])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '20.00' }])
    vi.mocked(colheitasApi.atualizarColheita).mockResolvedValue({
      id: 1,
      plantio: 1,
      data: '2026-08-05',
      classificacao: 'primeira',
      quantidade: '20.00',
    })

    renderComProvider()
    await screen.findByText(/10\.00/)
    await userEvent.click(screen.getByText('Editar'))

    expect(screen.getByLabelText('Quantidade (caixas)')).toHaveValue('10.00')

    await userEvent.clear(screen.getByLabelText('Quantidade (caixas)'))
    await userEvent.type(screen.getByLabelText('Quantidade (caixas)'), '20.00')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/20\.00/)).toBeInTheDocument()
  })

  it('excluir colheita remove o item da lista', async () => {
    vi.mocked(colheitasApi.listarColheitas)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, data: '2026-08-05', classificacao: 'primeira', quantidade: '10.00' }])
      .mockResolvedValueOnce([])
    vi.mocked(colheitasApi.excluirColheita).mockResolvedValue(undefined)

    renderComProvider()
    await screen.findByText(/Primeira/)
    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(screen.queryByText(/Primeira/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/ColheitasPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./ColheitasPage"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/pages/ColheitasPage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarColheitas,
  criarColheita,
  atualizarColheita,
  excluirColheita,
  ROTULOS_CLASSIFICACAO,
  type Colheita,
  type ColheitaInput,
} from '../api/colheitas'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ColheitaForm } from '../components/ColheitaForm'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; colheita: Colheita } | null

export function ColheitasPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Colheita | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const colheitasQuery = useQuery({ queryKey: ['colheitas'], queryFn: listarColheitas })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarColheita,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: ColheitaInput }) => atualizarColheita(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirColheita,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (colheitasQuery.isLoading || plantiosQuery.isLoading || talhoesQuery.isLoading || culturasQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (colheitasQuery.isError || plantiosQuery.isError || talhoesQuery.isError || culturasQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as colheitas.</p>
        <button
          onClick={() => {
            colheitasQuery.refetch()
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

  const colheitas = colheitasQuery.data ?? []
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
  const colheitasOrdenadas = [...colheitas].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Colheitas</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Colheita
        </button>
      </div>

      {formulario?.tipo === 'novo' && (
        <ColheitaForm
          plantioOpcoes={plantioOpcoes}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {colheitasOrdenadas.map((colheita) =>
          formulario?.tipo === 'editar' && formulario.colheita.id === colheita.id ? (
            <li key={colheita.id} className="mb-2 border p-2">
              <ColheitaForm
                plantioOpcoes={plantioOpcoes}
                colheita={colheita}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: colheita.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={colheita.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {labelPlantio(colheita.plantio)} —{' '}
                {new Date(`${colheita.data}T00:00:00`).toLocaleDateString('pt-BR')} —{' '}
                {ROTULOS_CLASSIFICACAO[colheita.classificacao]} — {colheita.quantidade} caixas
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', colheita })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(colheita)
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
        titulo="Excluir colheita"
        mensagem="Tem certeza que deseja excluir esta colheita?"
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

Run: `cd frontend && npx vitest run src/pages/ColheitasPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ColheitasPage.tsx frontend/src/pages/ColheitasPage.test.tsx
git commit -m "feat(harvest): adicionar ColheitasPage (criar, editar, excluir)"
```

---

### Task 6: Routing and navigation

**Files:**
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/layout/AppShell.tsx`
- Modify: `frontend/src/routes.test.tsx`

**Interfaces:**
- Consumes: `ColheitasPage` from `../pages/ColheitasPage` (Task 5).

- [ ] **Step 1: Write the failing test — append to `routes.test.tsx`**

In `frontend/src/routes.test.tsx`, inside the existing `describe('navegacao para as paginas de cadastro', ...)` block (after the "Tarefas" test added in fatia 3b, before the closing `})` of that `describe`), add:

```tsx
  it('link de Colheitas navega para a pagina de colheitas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // ColheitasPage dispara 4 fetches paralelos (colheitas/plantios/talhoes/culturas).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Colheitas' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Colheitas' })).toBeInTheDocument())
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: FAIL — no link named "Colheitas" exists yet.

- [ ] **Step 3: Add the route**

In `frontend/src/routes.tsx`, add the import (after the `TarefasPage` import):

```ts
import { ColheitasPage } from './pages/ColheitasPage'
```

Add the route object (after the `/tarefas` route, before the `{ path: '*', ... }` catch-all):

```tsx
  {
    path: '/colheitas',
    element: (
      <ProtectedRoute>
        <AppShell>
          <ColheitasPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
```

- [ ] **Step 4: Add the nav link**

In `frontend/src/layout/AppShell.tsx`, add a link after the "Tarefas" link, inside the existing `<nav>`:

```tsx
            <Link to="/colheitas">Colheitas</Link>
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
git commit -m "feat(frontend): adicionar rota e navegacao para colheitas"
```

---

## Post-plan: whole-branch review

After all 6 tasks are committed, run the final whole-branch review covering the full diff against `master`, with special attention to:

- The `data-segura-colheita` action genuinely stays scoped by user (a plantio ID from another user must 404, not 500 or leak data).
- `ColheitaForm`'s live `useQuery` never blocks or breaks submission when it fails or is still loading — it's purely informational.
- Every mutation across `ColheitasPage` has an `onError`, and the "Tentar novamente" button refetches all 4 of its queries.
