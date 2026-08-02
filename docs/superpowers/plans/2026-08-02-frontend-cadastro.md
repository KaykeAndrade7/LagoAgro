# Frontend: cadastro (Task #8, fatia 2/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir as três primeiras telas de domínio do frontend — Propriedades/Talhões, Culturas (read-only) e Plantios — consumindo a API real via TanStack Query, com formulários validados por react-hook-form + zod.

**Architecture:** Uma camada `api/*.ts` fina sobre `apiRequest<T>()` (já existente) por entidade, componentes de formulário reutilizáveis (react-hook-form + zod) por entidade, um `ConfirmDialog` genérico para exclusões com aviso de cascata, três páginas que orquestram `useQuery`/`useMutation`, e a extensão do roteamento/nav já existentes para alcançá-las.

**Tech Stack:** React 19 + TypeScript + TanStack Query v5 (já em `package.json`) + react-hook-form + zod + `@hookform/resolvers` (novas nesta fatia) + Vitest + React Testing Library + `@testing-library/user-event` (já em uso).

## Global Constraints

- Contrato real do backend (confirmado lendo `lagoagro/{properties,crops,plantings}/{models,serializers,views}.py` e `lagoagro/core/urls.py`):
  - `GET/POST/PATCH/DELETE /api/propriedades/` → `{id: number, nome: string}`.
  - `GET/POST/PATCH/DELETE /api/talhoes/` → `{id: number, propriedade: number, nome: string, area: string, tipo_solo: string}` (`area` é `DecimalField`, chega/sai como **string**, não número).
  - `GET /api/culturas/` → **somente leitura**, `{id: number, nome: string, ciclo_dias: number, fases: [{id, nome, dia_inicio, dia_fim}, ...]}` (fases já vêm ordenadas por `dia_inicio`). Nenhum endpoint de escrita existe — não criar um.
  - `GET/POST/PATCH/DELETE /api/plantios/` → `{id: number, talhao: number, cultura: number, data_plantio: string ("YYYY-MM-DD"), status: "em_andamento" | "colhido" | "cancelado"}`.
  - Nenhum desses endpoints pagina resultados (`lagoagro/core/settings.py` não define `DEFAULT_PAGINATION_CLASS` em `REST_FRAMEWORK`, confirmado lendo o arquivo) — toda lista é um array JSON puro.
- **react-hook-form + zod + `@hookform/resolvers`** para os três formulários desta fatia — decisão de stack válida também para as fatias seguintes (insumos, tarefas, colheita, financeiro).
- **Sem camada de hooks customizados por entidade** (nada de `useTalhoes()`) — cada entidade tem um único consumidor nesta fatia.
- **Sem optimistic update** — toda mutação usa `onSuccess` para invalidar a(s) query(ies) correspondente(s) via `queryClient.invalidateQueries({queryKey: [...]})` e deixa o refetch trazer o estado real.
- **Contagens de cascata (exclusão) são sempre client-side**, derivadas de queries já em cache (`['talhoes']`, `['plantios']`) — nunca um endpoint novo só para contar.
- **Testes:** Vitest + React Testing Library + `@testing-library/user-event` (mesma configuração de `frontend/vitest.config.ts` e `frontend/src/test-setup.ts`, já existentes, não mudam nesta fatia).
  - Testes de `api/*.ts`: stub de `fetch` global via `vi.stubGlobal('fetch', fetchMock)`, mesmo padrão de `frontend/src/lib/api-client.test.ts` — **não** usar `vi.mock('../lib/api-client')`, porque `apiRequest<T>` é genérico e mocká-lo via `vi.mock` cria fricção de tipos desnecessária; stubar `fetch` testa o mesmo comportamento sem esse problema.
  - Testes de página: `vi.mock('../api/<entidade>')` (automock) nos módulos `api/*.ts` concretos (não genéricos — `listarPropriedades(): Promise<Propriedade[]>` etc. não têm parâmetro de tipo, então `vi.mocked(...)` funciona sem fricção), envolvendo o componente num `QueryClientProvider` com um `QueryClient` novo por teste (`{defaultOptions: {queries: {retry: false}}}`, para não esperar retries em testes de erro).
- **Nenhuma mudança de backend nesta fatia** — Task #6 já implementou e testou os quatro endpoints.
- Import de tipos usa `import type { X } from '...'` (padrão já usado em `frontend/src/auth/ProtectedRoute.tsx:1`).

---

### Task 1: Camada de API — `api/propriedades.ts`, `api/talhoes.ts`, `api/culturas.ts`, `api/plantios.ts`

**Files:**
- Create: `frontend/src/api/propriedades.ts`
- Create: `frontend/src/api/propriedades.test.ts`
- Create: `frontend/src/api/talhoes.ts`
- Create: `frontend/src/api/talhoes.test.ts`
- Create: `frontend/src/api/culturas.ts`
- Create: `frontend/src/api/culturas.test.ts`
- Create: `frontend/src/api/plantios.ts`
- Create: `frontend/src/api/plantios.test.ts`

**Interfaces:**
- Consumes: `apiRequest<T>(path: string, options?: {method?: string; body?: unknown; headers?: HeadersInit}): Promise<T>` de `frontend/src/lib/api-client.ts:79` (já existe, não muda).
- Produces (usados pelas Tasks 3–8):
  - `Propriedade = {id: number; nome: string}`, `PropriedadeInput = {nome: string}`
  - `listarPropriedades(): Promise<Propriedade[]>`, `criarPropriedade(input: PropriedadeInput): Promise<Propriedade>`, `atualizarPropriedade(id: number, input: PropriedadeInput): Promise<Propriedade>`, `excluirPropriedade(id: number): Promise<void>`
  - `Talhao = {id: number; propriedade: number; nome: string; area: string; tipo_solo: string}`, `TalhaoInput = {propriedade: number; nome: string; area: string; tipo_solo: string}`
  - `listarTalhoes(): Promise<Talhao[]>`, `criarTalhao(input: TalhaoInput): Promise<Talhao>`, `atualizarTalhao(id: number, input: TalhaoInput): Promise<Talhao>`, `excluirTalhao(id: number): Promise<void>`
  - `FaseCultura = {id: number; nome: string; dia_inicio: number; dia_fim: number}`, `Cultura = {id: number; nome: string; ciclo_dias: number; fases: FaseCultura[]}`
  - `listarCulturas(): Promise<Cultura[]>`
  - `PlantioStatus = 'em_andamento' | 'colhido' | 'cancelado'`, `Plantio = {id: number; talhao: number; cultura: number; data_plantio: string; status: PlantioStatus}`, `PlantioInput = {talhao: number; cultura: number; data_plantio: string; status: PlantioStatus}`
  - `listarPlantios(): Promise<Plantio[]>`, `criarPlantio(input: PlantioInput): Promise<Plantio>`, `atualizarPlantio(id: number, input: PlantioInput): Promise<Plantio>`, `excluirPlantio(id: number): Promise<void>`
  - `ROTULOS_STATUS: Record<PlantioStatus, string>` — `{em_andamento: 'Em andamento', colhido: 'Colhido', cancelado: 'Cancelado'}`

- [ ] **Step 1: Escrever `frontend/src/api/propriedades.ts`**

```ts
import { apiRequest } from '../lib/api-client'

export type Propriedade = {
  id: number
  nome: string
}

export type PropriedadeInput = {
  nome: string
}

export function listarPropriedades(): Promise<Propriedade[]> {
  return apiRequest<Propriedade[]>('/propriedades/')
}

export function criarPropriedade(input: PropriedadeInput): Promise<Propriedade> {
  return apiRequest<Propriedade>('/propriedades/', { method: 'POST', body: input })
}

export function atualizarPropriedade(id: number, input: PropriedadeInput): Promise<Propriedade> {
  return apiRequest<Propriedade>(`/propriedades/${id}/`, { method: 'PATCH', body: input })
}

export function excluirPropriedade(id: number): Promise<void> {
  return apiRequest<void>(`/propriedades/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 2: Escrever `frontend/src/api/propriedades.test.ts` (teste falhando é o próprio arquivo ainda não implementado — pule para rodar depois do Step 1, já que Step 1 já contém a implementação; a ordem TDD aqui é: este teste deve passar rodando contra o Step 1)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarPropriedades, criarPropriedade, atualizarPropriedade, excluirPropriedade } from './propriedades'

describe('api/propriedades', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('listarPropriedades faz GET /api/propriedades/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ id: 1, nome: 'Sitio Bela Vista' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarPropriedades()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([{ id: 1, nome: 'Sitio Bela Vista' }])
  })

  it('criarPropriedade faz POST /api/propriedades/ com o corpo certo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 2, nome: 'Novo sitio' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await criarPropriedade({ nome: 'Novo sitio' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ nome: 'Novo sitio' }))
    expect(result).toEqual({ id: 2, nome: 'Novo sitio' })
  })

  it('atualizarPropriedade faz PATCH /api/propriedades/:id/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 1, nome: 'Nome atualizado' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await atualizarPropriedade(1, { nome: 'Nome atualizado' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/1/')
    expect(options.method).toBe('PATCH')
    expect(result).toEqual({ id: 1, nome: 'Nome atualizado' })
  })

  it('excluirPropriedade faz DELETE /api/propriedades/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirPropriedade(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/propriedades/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

Run: `cd frontend && npx vitest run src/api/propriedades.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Escrever `frontend/src/api/talhoes.ts`**

```ts
import { apiRequest } from '../lib/api-client'

export type Talhao = {
  id: number
  propriedade: number
  nome: string
  area: string
  tipo_solo: string
}

export type TalhaoInput = {
  propriedade: number
  nome: string
  area: string
  tipo_solo: string
}

export function listarTalhoes(): Promise<Talhao[]> {
  return apiRequest<Talhao[]>('/talhoes/')
}

export function criarTalhao(input: TalhaoInput): Promise<Talhao> {
  return apiRequest<Talhao>('/talhoes/', { method: 'POST', body: input })
}

export function atualizarTalhao(id: number, input: TalhaoInput): Promise<Talhao> {
  return apiRequest<Talhao>(`/talhoes/${id}/`, { method: 'PATCH', body: input })
}

export function excluirTalhao(id: number): Promise<void> {
  return apiRequest<void>(`/talhoes/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 4: Escrever `frontend/src/api/talhoes.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarTalhoes, criarTalhao, atualizarTalhao, excluirTalhao } from './talhoes'

describe('api/talhoes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }

  it('listarTalhoes faz GET /api/talhoes/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([talhao]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarTalhoes()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([talhao])
  })

  it('criarTalhao faz POST /api/talhoes/ com o corpo certo, incluindo propriedade', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(talhao), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }
    const result = await criarTalhao(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(talhao)
  })

  it('atualizarTalhao faz PATCH /api/talhoes/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(talhao), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarTalhao(1, { propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirTalhao faz DELETE /api/talhoes/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirTalhao(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/talhoes/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

Run: `cd frontend && npx vitest run src/api/talhoes.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Escrever `frontend/src/api/culturas.ts`**

```ts
import { apiRequest } from '../lib/api-client'

export type FaseCultura = {
  id: number
  nome: string
  dia_inicio: number
  dia_fim: number
}

export type Cultura = {
  id: number
  nome: string
  ciclo_dias: number
  fases: FaseCultura[]
}

export function listarCulturas(): Promise<Cultura[]> {
  return apiRequest<Cultura[]>('/culturas/')
}
```

- [ ] **Step 6: Escrever `frontend/src/api/culturas.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarCulturas } from './culturas'

describe('api/culturas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('listarCulturas faz GET /api/culturas/ e retorna as fases aninhadas', async () => {
    const cultura = {
      id: 1,
      nome: 'Tomate',
      ciclo_dias: 90,
      fases: [{ id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([cultura]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarCulturas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([cultura])
  })
})
```

Run: `cd frontend && npx vitest run src/api/culturas.test.ts`
Expected: 1 passed.

- [ ] **Step 7: Escrever `frontend/src/api/plantios.ts`**

```ts
import { apiRequest } from '../lib/api-client'

export type PlantioStatus = 'em_andamento' | 'colhido' | 'cancelado'

export type Plantio = {
  id: number
  talhao: number
  cultura: number
  data_plantio: string
  status: PlantioStatus
}

export type PlantioInput = {
  talhao: number
  cultura: number
  data_plantio: string
  status: PlantioStatus
}

export const ROTULOS_STATUS: Record<PlantioStatus, string> = {
  em_andamento: 'Em andamento',
  colhido: 'Colhido',
  cancelado: 'Cancelado',
}

export function listarPlantios(): Promise<Plantio[]> {
  return apiRequest<Plantio[]>('/plantios/')
}

export function criarPlantio(input: PlantioInput): Promise<Plantio> {
  return apiRequest<Plantio>('/plantios/', { method: 'POST', body: input })
}

export function atualizarPlantio(id: number, input: PlantioInput): Promise<Plantio> {
  return apiRequest<Plantio>(`/plantios/${id}/`, { method: 'PATCH', body: input })
}

export function excluirPlantio(id: number): Promise<void> {
  return apiRequest<void>(`/plantios/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 8: Escrever `frontend/src/api/plantios.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarPlantios, criarPlantio, atualizarPlantio, excluirPlantio } from './plantios'

describe('api/plantios', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' as const }

  it('listarPlantios faz GET /api/plantios/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([plantio]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarPlantios()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([plantio])
  })

  it('criarPlantio faz POST /api/plantios/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(plantio), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' as const }
    const result = await criarPlantio(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(plantio)
  })

  it('atualizarPlantio faz PATCH /api/plantios/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(plantio), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarPlantio(1, { talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'colhido' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirPlantio faz DELETE /api/plantios/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirPlantio(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/plantios/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

Run: `cd frontend && npx vitest run src/api/plantios.test.ts`
Expected: 4 passed.

- [ ] **Step 9: Rodar a suíte inteira e commitar**

Run: `cd frontend && npx vitest run src/api`
Expected: 13 passed (4+4+1+4).

```bash
git add frontend/src/api/
git commit -m "feat(frontend): adicionar camada de api para propriedades, talhoes, culturas e plantios"
```

---

### Task 2: `ConfirmDialog` (modal de confirmação genérico)

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`
- Create: `frontend/src/components/ConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores (componente autônomo, sem dependência de dados de domínio).
- Produces (usado pelas Tasks 5 e 7):

```ts
type ConfirmDialogProps = {
  aberto: boolean
  titulo: string
  mensagem: string
  onConfirm: () => void
  onCancel: () => void
}
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null
```

- [ ] **Step 1: Escrever `frontend/src/components/ConfirmDialog.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('nao renderiza nada quando aberto e false', () => {
    const { container } = render(
      <ConfirmDialog aberto={false} titulo="t" mensagem="m" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra titulo e mensagem quando aberto e true', () => {
    render(
      <ConfirmDialog
        aberto={true}
        titulo="Excluir talhao"
        mensagem="Isso tambem excluira 2 plantio(s)."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('Excluir talhao')).toBeInTheDocument()
    expect(screen.getByText('Isso tambem excluira 2 plantio(s).')).toBeInTheDocument()
  })

  it('confirmar dispara onConfirm e nao onCancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog aberto={true} titulo="t" mensagem="m" onConfirm={onConfirm} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Confirmar'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancelar dispara onCancel e nao onConfirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog aberto={true} titulo="t" mensagem="m" onConfirm={onConfirm} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
```

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: FAIL — módulo `./ConfirmDialog` não existe.

- [ ] **Step 2: Escrever `frontend/src/components/ConfirmDialog.tsx`**

```tsx
type ConfirmDialogProps = {
  aberto: boolean
  titulo: string
  mensagem: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ aberto, titulo, mensagem, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!aberto) return null

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="max-w-sm rounded bg-white p-6">
        <h2 className="mb-2 text-lg font-bold">{titulo}</h2>
        <p className="mb-4 text-sm">{mensagem}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border px-3 py-1 text-sm">
            Cancelar
          </button>
          <button onClick={onConfirm} className="rounded bg-red-600 px-3 py-1 text-sm text-white">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: 4 passed.

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/components/ConfirmDialog.test.tsx
git commit -m "feat(frontend): adicionar ConfirmDialog generico para exclusoes com aviso de cascata"
```

---

### Task 3: Instalar react-hook-form + zod; `PropriedadeForm` e `TalhaoForm`

**Files:**
- Modify: `frontend/package.json` (via `npm install`, não editar manualmente)
- Create: `frontend/src/components/PropriedadeForm.tsx`
- Create: `frontend/src/components/PropriedadeForm.test.tsx`
- Create: `frontend/src/components/TalhaoForm.tsx`
- Create: `frontend/src/components/TalhaoForm.test.tsx`

**Interfaces:**
- Consumes: `Propriedade`, `PropriedadeInput` de `frontend/src/api/propriedades.ts` (Task 1); `Talhao`, `TalhaoInput` de `frontend/src/api/talhoes.ts` (Task 1).
- Produces (usados pela Task 5):

```ts
type PropriedadeFormProps = {
  propriedade?: Propriedade
  onSubmit: (input: PropriedadeInput) => void
  onCancel: () => void
}
export function PropriedadeForm(props: PropriedadeFormProps): JSX.Element

type TalhaoFormProps = {
  propriedadeId: number
  talhao?: Talhao
  onSubmit: (input: TalhaoInput) => void
  onCancel: () => void
}
export function TalhaoForm(props: TalhaoFormProps): JSX.Element
```

- [ ] **Step 1: Instalar as dependências**

Run: `cd frontend && npm install react-hook-form zod @hookform/resolvers`
Expected: `package.json`/`package-lock.json` atualizados com as três dependências (versões exatas ficam a critério do `npm install` — não fixar versão manualmente).

- [ ] **Step 2: Escrever `frontend/src/components/PropriedadeForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PropriedadeForm } from './PropriedadeForm'

describe('PropriedadeForm', () => {
  it('chama onSubmit com o nome preenchido', async () => {
    const onSubmit = vi.fn()
    render(<PropriedadeForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Sitio Bela Vista')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Sitio Bela Vista' })
  })

  it('mostra erro de validacao e nao chama onSubmit quando nome esta vazio', async () => {
    const onSubmit = vi.fn()
    render(<PropriedadeForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Nome e obrigatorio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula o campo nome quando editando uma propriedade existente', () => {
    render(
      <PropriedadeForm propriedade={{ id: 1, nome: 'Sitio Existente' }} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Nome')).toHaveValue('Sitio Existente')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<PropriedadeForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

Run: `cd frontend && npx vitest run src/components/PropriedadeForm.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever `frontend/src/components/PropriedadeForm.tsx`**

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Propriedade, PropriedadeInput } from '../api/propriedades'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
})

type PropriedadeFormProps = {
  propriedade?: Propriedade
  onSubmit: (input: PropriedadeInput) => void
  onCancel: () => void
}

export function PropriedadeForm({ propriedade, onSubmit, onCancel }: PropriedadeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropriedadeInput>({
    resolver: zodResolver(schema),
    defaultValues: { nome: propriedade?.nome ?? '' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <div>
        <label htmlFor="propriedade-nome" className="block text-sm">
          Nome
        </label>
        <input id="propriedade-nome" {...register('nome')} className="border px-2 py-1" />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome.message}</p>}
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

**Nota para o implementador:** o `<label htmlFor="propriedade-nome">` precisa ter `id="propriedade-nome"` correspondente no `<input>` pra `getByLabelText('Nome')` funcionar no teste — já está correto acima, mas confira se copiar/adaptar.

- [ ] **Step 4: Rodar os testes de `PropriedadeForm`**

Run: `cd frontend && npx vitest run src/components/PropriedadeForm.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Escrever `frontend/src/components/TalhaoForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TalhaoForm } from './TalhaoForm'

describe('TalhaoForm', () => {
  it('chama onSubmit com os valores preenchidos, incluindo propriedadeId', async () => {
    const onSubmit = vi.fn()
    render(<TalhaoForm propriedadeId={7} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Talhao Norte')
    await userEvent.type(screen.getByLabelText('Area (hectares)'), '3.5')
    await userEvent.type(screen.getByLabelText('Tipo de solo'), 'Argiloso')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      propriedade: 7,
      nome: 'Talhao Norte',
      area: '3.5',
      tipo_solo: 'Argiloso',
    })
  })

  it('mostra erro quando area nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<TalhaoForm propriedadeId={7} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Talhao Norte')
    await userEvent.type(screen.getByLabelText('Area (hectares)'), 'abc')
    await userEvent.type(screen.getByLabelText('Tipo de solo'), 'Argiloso')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Area deve ser um numero maior que zero')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um talhao existente', () => {
    const talhao = { id: 1, propriedade: 7, nome: 'Talhao Existente', area: '2.00', tipo_solo: 'Arenoso' }
    render(<TalhaoForm propriedadeId={7} talhao={talhao} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Talhao Existente')
    expect(screen.getByLabelText('Area (hectares)')).toHaveValue('2.00')
    expect(screen.getByLabelText('Tipo de solo')).toHaveValue('Arenoso')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<TalhaoForm propriedadeId={7} onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

Run: `cd frontend && npx vitest run src/components/TalhaoForm.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 6: Escrever `frontend/src/components/TalhaoForm.tsx`**

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Talhao, TalhaoInput } from '../api/talhoes'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  area: z
    .string()
    .min(1, 'Area e obrigatoria')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Area deve ser um numero maior que zero'),
  tipo_solo: z.string().min(1, 'Tipo de solo e obrigatorio'),
})

type TalhaoFormValues = z.infer<typeof schema>

type TalhaoFormProps = {
  propriedadeId: number
  talhao?: Talhao
  onSubmit: (input: TalhaoInput) => void
  onCancel: () => void
}

export function TalhaoForm({ propriedadeId, talhao, onSubmit, onCancel }: TalhaoFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TalhaoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: talhao?.nome ?? '',
      area: talhao?.area ?? '',
      tipo_solo: talhao?.tipo_solo ?? '',
    },
  })

  function aoSubmeter(values: TalhaoFormValues) {
    onSubmit({ propriedade: propriedadeId, ...values })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-2">
      <div>
        <label htmlFor="talhao-nome" className="block text-sm">
          Nome
        </label>
        <input id="talhao-nome" {...register('nome')} className="border px-2 py-1" />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome.message}</p>}
      </div>
      <div>
        <label htmlFor="talhao-area" className="block text-sm">
          Area (hectares)
        </label>
        <input id="talhao-area" {...register('area')} className="border px-2 py-1" />
        {errors.area && <p className="text-sm text-red-600">{errors.area.message}</p>}
      </div>
      <div>
        <label htmlFor="talhao-tipo-solo" className="block text-sm">
          Tipo de solo
        </label>
        <input id="talhao-tipo-solo" {...register('tipo_solo')} className="border px-2 py-1" />
        {errors.tipo_solo && <p className="text-sm text-red-600">{errors.tipo_solo.message}</p>}
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

- [ ] **Step 7: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/components/PropriedadeForm.test.tsx src/components/TalhaoForm.test.tsx`
Expected: 8 passed.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/PropriedadeForm.tsx frontend/src/components/PropriedadeForm.test.tsx frontend/src/components/TalhaoForm.tsx frontend/src/components/TalhaoForm.test.tsx
git commit -m "feat(frontend): adicionar react-hook-form+zod e os formularios de propriedade e talhao"
```

---

### Task 4: `PlantioForm`

**Files:**
- Create: `frontend/src/components/PlantioForm.tsx`
- Create: `frontend/src/components/PlantioForm.test.tsx`

**Interfaces:**
- Consumes: `Talhao` de `frontend/src/api/talhoes.ts`; `Cultura` de `frontend/src/api/culturas.ts`; `Plantio`, `PlantioInput`, `PlantioStatus`, `ROTULOS_STATUS` de `frontend/src/api/plantios.ts` (todos Task 1); `react-hook-form`/`zod`/`@hookform/resolvers` (instalados na Task 3).
- Produces (usado pela Task 7):

```ts
type PlantioFormProps = {
  talhoes: Talhao[]
  culturas: Cultura[]
  plantio?: Plantio
  onSubmit: (input: PlantioInput) => void
  onCancel: () => void
}
export function PlantioForm(props: PlantioFormProps): JSX.Element
```

- [ ] **Step 1: Escrever `frontend/src/components/PlantioForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlantioForm } from './PlantioForm'
import type { Talhao } from '../api/talhoes'
import type { Cultura } from '../api/culturas'

const talhoes: Talhao[] = [{ id: 1, propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }]
const culturas: Cultura[] = [{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }]

describe('PlantioForm', () => {
  it('popula os selects de talhao e cultura a partir das props', () => {
    render(<PlantioForm talhoes={talhoes} culturas={culturas} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Talhao 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tomate' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores selecionados', async () => {
    const onSubmit = vi.fn()
    render(<PlantioForm talhoes={talhoes} culturas={culturas} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Talhao'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Cultura'), '1')
    await userEvent.type(screen.getByLabelText('Data do plantio'), '2026-08-02')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      talhao: 1,
      cultura: 1,
      data_plantio: '2026-08-02',
      status: 'em_andamento',
    })
  })

  it('mostra erro e nao chama onSubmit quando nenhum talhao e selecionado', async () => {
    const onSubmit = vi.fn()
    render(<PlantioForm talhoes={talhoes} culturas={culturas} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Data do plantio'), '2026-08-02')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um talhao')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um plantio existente', () => {
    const plantio = { id: 5, talhao: 1, cultura: 1, data_plantio: '2026-07-01', status: 'colhido' as const }
    render(
      <PlantioForm talhoes={talhoes} culturas={culturas} plantio={plantio} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByLabelText('Data do plantio')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('Status')).toHaveValue('colhido')
  })
})
```

Run: `cd frontend && npx vitest run src/components/PlantioForm.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/components/PlantioForm.tsx`**

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Talhao } from '../api/talhoes'
import type { Cultura } from '../api/culturas'
import { ROTULOS_STATUS, type Plantio, type PlantioInput, type PlantioStatus } from '../api/plantios'

const schema = z.object({
  talhao: z.coerce.number().min(1, 'Selecione um talhao'),
  cultura: z.coerce.number().min(1, 'Selecione uma cultura'),
  data_plantio: z.string().min(1, 'Data e obrigatoria'),
  status: z.enum(['em_andamento', 'colhido', 'cancelado']),
})

type PlantioFormValues = z.infer<typeof schema>

type PlantioFormProps = {
  talhoes: Talhao[]
  culturas: Cultura[]
  plantio?: Plantio
  onSubmit: (input: PlantioInput) => void
  onCancel: () => void
}

export function PlantioForm({ talhoes, culturas, plantio, onSubmit, onCancel }: PlantioFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlantioFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      talhao: plantio?.talhao ?? 0,
      cultura: plantio?.cultura ?? 0,
      data_plantio: plantio?.data_plantio ?? '',
      status: plantio?.status ?? 'em_andamento',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <div>
        <label htmlFor="plantio-talhao" className="block text-sm">
          Talhao
        </label>
        <select id="plantio-talhao" {...register('talhao')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {talhoes.map((talhao) => (
            <option key={talhao.id} value={talhao.id}>
              {talhao.nome}
            </option>
          ))}
        </select>
        {errors.talhao && <p className="text-sm text-red-600">{errors.talhao.message}</p>}
      </div>
      <div>
        <label htmlFor="plantio-cultura" className="block text-sm">
          Cultura
        </label>
        <select id="plantio-cultura" {...register('cultura')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {culturas.map((cultura) => (
            <option key={cultura.id} value={cultura.id}>
              {cultura.nome}
            </option>
          ))}
        </select>
        {errors.cultura && <p className="text-sm text-red-600">{errors.cultura.message}</p>}
      </div>
      <div>
        <label htmlFor="plantio-data" className="block text-sm">
          Data do plantio
        </label>
        <input id="plantio-data" type="date" {...register('data_plantio')} className="border px-2 py-1" />
        {errors.data_plantio && <p className="text-sm text-red-600">{errors.data_plantio.message}</p>}
      </div>
      <div>
        <label htmlFor="plantio-status" className="block text-sm">
          Status
        </label>
        <select id="plantio-status" {...register('status')} className="border px-2 py-1">
          {(Object.keys(ROTULOS_STATUS) as PlantioStatus[]).map((status) => (
            <option key={status} value={status}>
              {ROTULOS_STATUS[status]}
            </option>
          ))}
        </select>
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

- [ ] **Step 3: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/components/PlantioForm.test.tsx`
Expected: 4 passed.

Se o teste de tipar a data (`userEvent.type(screen.getByLabelText('Data do plantio'), '2026-08-02')`) falhar por causa de como o jsdom trata `<input type="date">`, troque por `fireEvent.change(screen.getByLabelText('Data do plantio'), {target: {value: '2026-08-02'}})` (importar `fireEvent` de `@testing-library/react`) — é uma alternativa equivalente e mais confiável para esse tipo de input.

```bash
git add frontend/src/components/PlantioForm.tsx frontend/src/components/PlantioForm.test.tsx
git commit -m "feat(frontend): adicionar formulario de plantio"
```

---

### Task 5: `PropriedadesPage`

**Files:**
- Create: `frontend/src/pages/PropriedadesPage.tsx`
- Create: `frontend/src/pages/PropriedadesPage.test.tsx`

**Interfaces:**
- Consumes: tudo de `frontend/src/api/propriedades.ts`, `frontend/src/api/talhoes.ts`, `listarPlantios` de `frontend/src/api/plantios.ts` (Task 1); `ConfirmDialog` (Task 2); `PropriedadeForm`, `TalhaoForm` (Task 3); `useQuery`/`useMutation`/`useQueryClient` de `@tanstack/react-query` (já em `package.json`).
- Produces: `export function PropriedadesPage(): JSX.Element` (usado pela Task 8 em `routes.tsx`).

- [ ] **Step 1: Escrever `frontend/src/pages/PropriedadesPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PropriedadesPage } from './PropriedadesPage'
import * as propriedadesApi from '../api/propriedades'
import * as talhoesApi from '../api/talhoes'
import * as plantiosApi from '../api/plantios'

vi.mock('../api/propriedades')
vi.mock('../api/talhoes')
vi.mock('../api/plantios')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PropriedadesPage />
    </QueryClientProvider>,
  )
}

describe('PropriedadesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([])
  })

  it('lista carrega e renderiza as propriedades', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([{ id: 1, nome: 'Sitio Bela Vista' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([])

    renderComProvider()

    expect(await screen.findByText(/Sitio Bela Vista/)).toBeInTheDocument()
  })

  it('expandir uma propriedade mostra so os talhoes daquela propriedade', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([
      { id: 1, nome: 'Sitio A' },
      { id: 2, nome: 'Sitio B' },
    ])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 10, propriedade: 1, nome: 'Talhao A1', area: '1.00', tipo_solo: 'Arenoso' },
      { id: 20, propriedade: 2, nome: 'Talhao B1', area: '2.00', tipo_solo: 'Argiloso' },
    ])

    renderComProvider()
    await screen.findByText(/Sitio A/)

    await userEvent.click(screen.getByText(/Sitio A/))

    expect(screen.getByText(/Talhao A1/)).toBeInTheDocument()
    expect(screen.queryByText(/Talhao B1/)).not.toBeInTheDocument()
  })

  it('criar propriedade via formulario adiciona o item a lista', async () => {
    vi.mocked(propriedadesApi.listarPropriedades)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, nome: 'Nova propriedade' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([])
    vi.mocked(propriedadesApi.criarPropriedade).mockResolvedValue({ id: 1, nome: 'Nova propriedade' })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Propriedade'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Nova propriedade')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Nova propriedade/)).toBeInTheDocument()
  })

  it('excluir propriedade com talhoes mostra o aviso de cascata com a contagem certa', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([{ id: 1, nome: 'Sitio A' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 10, propriedade: 1, nome: 'Talhao A1', area: '1.00', tipo_solo: 'Arenoso' },
      { id: 11, propriedade: 1, nome: 'Talhao A2', area: '1.00', tipo_solo: 'Arenoso' },
    ])

    renderComProvider()
    await screen.findByText(/Sitio A/)

    await userEvent.click(screen.getAllByText('Excluir')[0])

    expect(
      await screen.findByText('Isso tambem excluira 2 talhao(oes) e todos os plantios registrados neles.'),
    ).toBeInTheDocument()
  })

  it('excluir talhao com plantios mostra o aviso de cascata com a contagem certa', async () => {
    vi.mocked(propriedadesApi.listarPropriedades).mockResolvedValue([{ id: 1, nome: 'Sitio A' }])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 10, propriedade: 1, nome: 'Talhao A1', area: '1.00', tipo_solo: 'Arenoso' },
    ])
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([
      { id: 100, talhao: 10, cultura: 1, data_plantio: '2026-01-01', status: 'em_andamento' },
    ])

    renderComProvider()
    await screen.findByText(/Sitio A/)
    await userEvent.click(screen.getByText(/Sitio A/))
    await screen.findByText(/Talhao A1/)

    await userEvent.click(screen.getAllByText('Excluir')[1])

    expect(
      await screen.findByText('Isso tambem excluira 1 plantio(s) registrado(s) neste talhao.'),
    ).toBeInTheDocument()
  })
})
```

Run: `cd frontend && npx vitest run src/pages/PropriedadesPage.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/pages/PropriedadesPage.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarPropriedades,
  criarPropriedade,
  atualizarPropriedade,
  excluirPropriedade,
  type Propriedade,
  type PropriedadeInput,
} from '../api/propriedades'
import {
  listarTalhoes,
  criarTalhao,
  atualizarTalhao,
  excluirTalhao,
  type Talhao,
  type TalhaoInput,
} from '../api/talhoes'
import { listarPlantios } from '../api/plantios'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PropriedadeForm } from '../components/PropriedadeForm'
import { TalhaoForm } from '../components/TalhaoForm'

type FormularioAberto =
  | { tipo: 'nova-propriedade' }
  | { tipo: 'editar-propriedade'; propriedade: Propriedade }
  | { tipo: 'novo-talhao'; propriedadeId: number }
  | { tipo: 'editar-talhao'; talhao: Talhao }
  | null

type ExclusaoPendente = { tipo: 'propriedade'; propriedade: Propriedade } | { tipo: 'talhao'; talhao: Talhao } | null

export function PropriedadesPage() {
  const queryClient = useQueryClient()
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<ExclusaoPendente>(null)

  const propriedadesQuery = useQuery({ queryKey: ['propriedades'], queryFn: listarPropriedades })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })

  const criarPropriedadeMutation = useMutation({
    mutationFn: criarPropriedade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      setFormulario(null)
    },
  })

  const atualizarPropriedadeMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PropriedadeInput }) => atualizarPropriedade(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      setFormulario(null)
    },
  })

  const excluirPropriedadeMutation = useMutation({
    mutationFn: excluirPropriedade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propriedades'] })
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setExclusaoPendente(null)
    },
  })

  const criarTalhaoMutation = useMutation({
    mutationFn: criarTalhao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      setFormulario(null)
    },
  })

  const atualizarTalhaoMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: TalhaoInput }) => atualizarTalhao(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      setFormulario(null)
    },
  })

  const excluirTalhaoMutation = useMutation({
    mutationFn: excluirTalhao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] })
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setExclusaoPendente(null)
    },
  })

  function alternarExpansao(propriedadeId: number) {
    setExpandidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(propriedadeId)) {
        proximo.delete(propriedadeId)
      } else {
        proximo.add(propriedadeId)
      }
      return proximo
    })
  }

  if (propriedadesQuery.isLoading || talhoesQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (propriedadesQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as propriedades.</p>
        <button onClick={() => propriedadesQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const propriedades = propriedadesQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const plantios = plantiosQuery.data ?? []

  function mensagemExclusao(): string {
    if (exclusaoPendente?.tipo === 'propriedade') {
      const n = talhoes.filter((t) => t.propriedade === exclusaoPendente.propriedade.id).length
      return n > 0
        ? `Isso tambem excluira ${n} talhao(oes) e todos os plantios registrados neles.`
        : 'Tem certeza que deseja excluir esta propriedade?'
    }
    if (exclusaoPendente?.tipo === 'talhao') {
      const n = plantios.filter((p) => p.talhao === exclusaoPendente.talhao.id).length
      return n > 0
        ? `Isso tambem excluira ${n} plantio(s) registrado(s) neste talhao.`
        : 'Tem certeza que deseja excluir este talhao?'
    }
    return ''
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Propriedades</h1>
        <button
          onClick={() => setFormulario({ tipo: 'nova-propriedade' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Propriedade
        </button>
      </div>

      {formulario?.tipo === 'nova-propriedade' && (
        <PropriedadeForm
          onSubmit={(input) => criarPropriedadeMutation.mutate(input)}
          onCancel={() => setFormulario(null)}
        />
      )}
      {formulario?.tipo === 'editar-propriedade' && (
        <PropriedadeForm
          propriedade={formulario.propriedade}
          onSubmit={(input) => atualizarPropriedadeMutation.mutate({ id: formulario.propriedade.id, input })}
          onCancel={() => setFormulario(null)}
        />
      )}

      <ul>
        {propriedades.map((propriedade) => {
          const talhoesDaPropriedade = talhoes.filter((talhao) => talhao.propriedade === propriedade.id)
          const expandida = expandidas.has(propriedade.id)

          return (
            <li key={propriedade.id} className="mb-2 border p-2">
              <div className="flex items-center justify-between">
                <button onClick={() => alternarExpansao(propriedade.id)} className="text-left font-semibold">
                  {expandida ? '▾' : '▸'} {propriedade.nome}
                </button>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => setFormulario({ tipo: 'editar-propriedade', propriedade })}>Editar</button>
                  <button onClick={() => setExclusaoPendente({ tipo: 'propriedade', propriedade })}>Excluir</button>
                </div>
              </div>

              {expandida && (
                <div className="ml-4 mt-2">
                  {formulario?.tipo === 'novo-talhao' && formulario.propriedadeId === propriedade.id && (
                    <TalhaoForm
                      propriedadeId={propriedade.id}
                      onSubmit={(input) => criarTalhaoMutation.mutate(input)}
                      onCancel={() => setFormulario(null)}
                    />
                  )}
                  <ul>
                    {talhoesDaPropriedade.map((talhao) => (
                      <li key={talhao.id} className="mb-1 flex items-center justify-between">
                        {formulario?.tipo === 'editar-talhao' && formulario.talhao.id === talhao.id ? (
                          <TalhaoForm
                            propriedadeId={propriedade.id}
                            talhao={talhao}
                            onSubmit={(input) => atualizarTalhaoMutation.mutate({ id: talhao.id, input })}
                            onCancel={() => setFormulario(null)}
                          />
                        ) : (
                          <>
                            <span>
                              {talhao.nome} — {talhao.area} ha ({talhao.tipo_solo})
                            </span>
                            <div className="flex gap-2 text-sm">
                              <button onClick={() => setFormulario({ tipo: 'editar-talhao', talhao })}>
                                Editar
                              </button>
                              <button onClick={() => setExclusaoPendente({ tipo: 'talhao', talhao })}>
                                Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setFormulario({ tipo: 'novo-talhao', propriedadeId: propriedade.id })}
                    className="mt-1 text-sm"
                  >
                    + Talhao
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo={exclusaoPendente?.tipo === 'propriedade' ? 'Excluir propriedade' : 'Excluir talhao'}
        mensagem={mensagemExclusao()}
        onConfirm={() => {
          if (exclusaoPendente?.tipo === 'propriedade') {
            excluirPropriedadeMutation.mutate(exclusaoPendente.propriedade.id)
          } else if (exclusaoPendente?.tipo === 'talhao') {
            excluirTalhaoMutation.mutate(exclusaoPendente.talhao.id)
          }
        }}
        onCancel={() => setExclusaoPendente(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/pages/PropriedadesPage.test.tsx`
Expected: 6 passed.

```bash
git add frontend/src/pages/PropriedadesPage.tsx frontend/src/pages/PropriedadesPage.test.tsx
git commit -m "feat(frontend): adicionar PropriedadesPage com talhoes aninhados e exclusao em cascata"
```

---

### Task 6: `CulturasPage`

**Files:**
- Create: `frontend/src/pages/CulturasPage.tsx`
- Create: `frontend/src/pages/CulturasPage.test.tsx`

**Interfaces:**
- Consumes: `listarCulturas` de `frontend/src/api/culturas.ts` (Task 1).
- Produces: `export function CulturasPage(): JSX.Element` (usado pela Task 8).

- [ ] **Step 1: Escrever `frontend/src/pages/CulturasPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CulturasPage } from './CulturasPage'
import * as culturasApi from '../api/culturas'

vi.mock('../api/culturas')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CulturasPage />
    </QueryClientProvider>,
  )
}

describe('CulturasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lista carrega e mostra nome e ciclo de cada cultura', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }])

    renderComProvider()

    expect(await screen.findByText(/Tomate.*90 dias/)).toBeInTheDocument()
  })

  it('expandir uma cultura mostra suas fases na ordem certa', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([
      {
        id: 1,
        nome: 'Tomate',
        ciclo_dias: 90,
        fases: [
          { id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 },
          { id: 2, nome: 'Floracao', dia_inicio: 21, dia_fim: 50 },
        ],
      },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText(/Tomate/))

    const fases = screen.getAllByText(/dia \d+ a \d+/)
    expect(fases[0]).toHaveTextContent('Muda')
    expect(fases[1]).toHaveTextContent('Floracao')
  })

  it('nao mostra nenhum elemento de criar, editar ou excluir', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }])

    renderComProvider()
    await screen.findByText(/Tomate/)

    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Excluir')).not.toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
  })
})
```

Run: `cd frontend && npx vitest run src/pages/CulturasPage.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/pages/CulturasPage.tsx`**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarCulturas } from '../api/culturas'

export function CulturasPage() {
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function alternarExpansao(culturaId: number) {
    setExpandidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(culturaId)) {
        proximo.delete(culturaId)
      } else {
        proximo.add(culturaId)
      }
      return proximo
    })
  }

  if (culturasQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (culturasQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as culturas.</p>
        <button onClick={() => culturasQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const culturas = culturasQuery.data ?? []

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Culturas</h1>
      <ul>
        {culturas.map((cultura) => {
          const expandida = expandidas.has(cultura.id)
          return (
            <li key={cultura.id} className="mb-2 border p-2">
              <button onClick={() => alternarExpansao(cultura.id)} className="text-left font-semibold">
                {expandida ? '▾' : '▸'} {cultura.nome} ({cultura.ciclo_dias} dias)
              </button>
              {expandida && (
                <ul className="ml-4 mt-2">
                  {cultura.fases.map((fase) => (
                    <li key={fase.id} className="text-sm">
                      {fase.nome}: dia {fase.dia_inicio} a {fase.dia_fim}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/pages/CulturasPage.test.tsx`
Expected: 3 passed.

```bash
git add frontend/src/pages/CulturasPage.tsx frontend/src/pages/CulturasPage.test.tsx
git commit -m "feat(frontend): adicionar CulturasPage somente leitura com fases expansiveis"
```

---

### Task 7: `PlantiosPage`

**Files:**
- Create: `frontend/src/pages/PlantiosPage.tsx`
- Create: `frontend/src/pages/PlantiosPage.test.tsx`

**Interfaces:**
- Consumes: tudo de `frontend/src/api/plantios.ts` (incl. `ROTULOS_STATUS`), `listarTalhoes` de `frontend/src/api/talhoes.ts`, `listarCulturas` de `frontend/src/api/culturas.ts` (Task 1); `ConfirmDialog` (Task 2); `PlantioForm` (Task 4).
- Produces: `export function PlantiosPage(): JSX.Element` (usado pela Task 8).

- [ ] **Step 1: Escrever `frontend/src/pages/PlantiosPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlantiosPage } from './PlantiosPage'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'

vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlantiosPage />
    </QueryClientProvider>,
  )
}

describe('PlantiosPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([
      { id: 1, propriedade: 1, nome: 'Talhao 1', area: '1.00', tipo_solo: 'Arenoso' },
    ])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([{ id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }])
  })

  it('selects do formulario sao populados a partir das queries de talhoes e culturas', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([])

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Plantio'))

    expect(screen.getByRole('option', { name: 'Talhao 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tomate' })).toBeInTheDocument()
  })

  it('criar plantio faz o novo item aparecer na lista com os rotulos certos', async () => {
    vi.mocked(plantiosApi.listarPlantios)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' }])
    vi.mocked(plantiosApi.criarPlantio).mockResolvedValue({
      id: 1,
      talhao: 1,
      cultura: 1,
      data_plantio: '2026-08-02',
      status: 'em_andamento',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Plantio'))
    await userEvent.selectOptions(screen.getByLabelText('Talhao'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Cultura'), '1')
    await userEvent.type(screen.getByLabelText('Data do plantio'), '2026-08-02')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Tomate.*Talhao 1/)).toBeInTheDocument()
    expect(screen.getByText(/Em andamento/)).toBeInTheDocument()
  })

  it('editar um plantio existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    const plantioOriginal = {
      id: 1,
      talhao: 1,
      cultura: 1,
      data_plantio: '2026-08-02',
      status: 'em_andamento' as const,
    }
    vi.mocked(plantiosApi.listarPlantios)
      .mockResolvedValueOnce([plantioOriginal])
      .mockResolvedValueOnce([{ ...plantioOriginal, status: 'colhido' }])
    vi.mocked(plantiosApi.atualizarPlantio).mockResolvedValue({ ...plantioOriginal, status: 'colhido' })

    renderComProvider()
    await userEvent.click(await screen.findByText('Editar'))

    expect(screen.getByLabelText('Status')).toHaveValue('em_andamento')

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'colhido')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Colhido/)).toBeInTheDocument()
  })

  it('excluir plantio pede confirmacao antes de excluir', async () => {
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([
      { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText('Excluir'))

    expect(screen.getByText('Tem certeza que deseja excluir este plantio?')).toBeInTheDocument()
    expect(plantiosApi.excluirPlantio).not.toHaveBeenCalled()
  })
})
```

Run: `cd frontend && npx vitest run src/pages/PlantiosPage.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/pages/PlantiosPage.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarPlantios,
  criarPlantio,
  atualizarPlantio,
  excluirPlantio,
  ROTULOS_STATUS,
  type Plantio,
  type PlantioInput,
} from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlantioForm } from '../components/PlantioForm'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; plantio: Plantio } | null

export function PlantiosPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Plantio | null>(null)

  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  const criarMutation = useMutation({
    mutationFn: criarPlantio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setFormulario(null)
    },
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PlantioInput }) => atualizarPlantio(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setFormulario(null)
    },
  })

  const excluirMutation = useMutation({
    mutationFn: excluirPlantio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantios'] })
      setExclusaoPendente(null)
    },
  })

  if (plantiosQuery.isLoading || talhoesQuery.isLoading || culturasQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (plantiosQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar os plantios.</p>
        <button onClick={() => plantiosQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []

  function nomeTalhao(id: number): string {
    return talhoes.find((t) => t.id === id)?.nome ?? '—'
  }
  function nomeCultura(id: number): string {
    return culturas.find((c) => c.id === id)?.nome ?? '—'
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Plantios</h1>
        <button
          onClick={() => setFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Plantio
        </button>
      </div>

      {formulario?.tipo === 'novo' && (
        <PlantioForm
          talhoes={talhoes}
          culturas={culturas}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => setFormulario(null)}
        />
      )}

      <ul>
        {plantios.map((plantio) =>
          formulario?.tipo === 'editar' && formulario.plantio.id === plantio.id ? (
            <li key={plantio.id} className="mb-2 border p-2">
              <PlantioForm
                talhoes={talhoes}
                culturas={culturas}
                plantio={plantio}
                onSubmit={(input) => atualizarMutation.mutate({ id: plantio.id, input })}
                onCancel={() => setFormulario(null)}
              />
            </li>
          ) : (
            <li key={plantio.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {nomeCultura(plantio.cultura)} — {nomeTalhao(plantio.talhao)} —{' '}
                {new Date(`${plantio.data_plantio}T00:00:00`).toLocaleDateString('pt-BR')} —{' '}
                {ROTULOS_STATUS[plantio.status]}
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => setFormulario({ tipo: 'editar', plantio })}>Editar</button>
                <button onClick={() => setExclusaoPendente(plantio)}>Excluir</button>
              </div>
            </li>
          ),
        )}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir plantio"
        mensagem="Tem certeza que deseja excluir este plantio?"
        onConfirm={() => {
          if (exclusaoPendente) excluirMutation.mutate(exclusaoPendente.id)
        }}
        onCancel={() => setExclusaoPendente(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/pages/PlantiosPage.test.tsx`
Expected: 5 passed. Se o teste que digita a data (`userEvent.type` num `<input type="date">`) falhar, aplique a mesma alternativa da Task 4 (`fireEvent.change`).

```bash
git add frontend/src/pages/PlantiosPage.tsx frontend/src/pages/PlantiosPage.test.tsx
git commit -m "feat(frontend): adicionar PlantiosPage com criacao, edicao e exclusao"
```

---

### Task 8: Roteamento e navegação (`routes.tsx` + `AppShell.tsx`)

**Files:**
- Modify: `frontend/src/routes.tsx` (atualmente em `frontend/src/routes.tsx:1-20`, ver conteúdo completo abaixo)
- Modify: `frontend/src/layout/AppShell.tsx` (atualmente em `frontend/src/layout/AppShell.tsx:1-18`)
- Modify: `frontend/src/routes.test.tsx` (acrescentar testes, sem remover os existentes)

**Interfaces:**
- Consumes: `PropriedadesPage` (Task 5), `CulturasPage` (Task 6), `PlantiosPage` (Task 7); `ProtectedRoute`, `AppShell` já existentes (não mudam de assinatura).
- Produces: nenhuma interface nova para tasks futuras — esta é a última task da fatia.

- [ ] **Step 1: Adicionar aos testes existentes em `frontend/src/routes.test.tsx` (não remover os 3 testes já existentes no arquivo — apenas acrescentar este `describe` novo ao final do arquivo)**

```tsx
describe('navegacao para as paginas de cadastro', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await router.navigate('/')
  })

  it('link de Propriedades navega para a pagina de propriedades', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })) // propriedades/talhoes/plantios
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Propriedades' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Propriedades' })).toBeInTheDocument())
  })

  it('link de Culturas navega para a pagina de culturas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })) // culturas
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Culturas' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Culturas' })).toBeInTheDocument())
  })

  it('link de Plantios navega para a pagina de plantios', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })) // plantios/talhoes/culturas
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Plantios' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plantios' })).toBeInTheDocument())
  })
})
```

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: FAIL nos 3 testes novos (links "Propriedades"/"Culturas"/"Plantios" ainda não existem no `AppShell`, rotas ainda não existem).

- [ ] **Step 2: Modificar `frontend/src/layout/AppShell.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()

  return (
    <div>
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <span className="font-bold">LagoAgro</span>
          <nav className="flex gap-3 text-sm">
            <Link to="/">Painel</Link>
            <Link to="/propriedades">Propriedades</Link>
            <Link to="/culturas">Culturas</Link>
            <Link to="/plantios">Plantios</Link>
          </nav>
        </div>
        <button onClick={() => logout()} className="text-sm">
          Sair
        </button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Modificar `frontend/src/routes.tsx`**

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { PropriedadesPage } from './pages/PropriedadesPage'
import { CulturasPage } from './pages/CulturasPage'
import { PlantiosPage } from './pages/PlantiosPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/propriedades',
    element: (
      <ProtectedRoute>
        <AppShell>
          <PropriedadesPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/culturas',
    element: (
      <ProtectedRoute>
        <AppShell>
          <CulturasPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/plantios',
    element: (
      <ProtectedRoute>
        <AppShell>
          <PlantiosPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
```

- [ ] **Step 4: Rodar a suíte inteira do frontend e commitar**

Run: `cd frontend && npx vitest run`
Expected: todos os testes passam (os 3 originais de `routes.test.tsx` + os 3 novos + tudo das Tasks 1–7).

```bash
git add frontend/src/routes.tsx frontend/src/layout/AppShell.tsx frontend/src/routes.test.tsx
git commit -m "feat(frontend): adicionar rotas e navegacao para propriedades, culturas e plantios"
```

---

## Self-Review (executado ao final da escrita deste plano)

**1. Cobertura da spec:** todas as seções de
`docs/superpowers/specs/2026-08-02-frontend-cadastro-design.md` têm task
correspondente — camada de API (Task 1), `ConfirmDialog` (Task 2),
formulários com react-hook-form+zod (Tasks 3–4), as três páginas (Tasks
5–7), navegação (Task 8). A seção "Fora de escopo" da spec não gerou
nenhuma task, como esperado.

**2. Placeholder scan:** nenhum "TBD"/"TODO"/"implementar depois" — toda
task tem código completo e comandos de teste reais.

**3. Consistência de tipos:** `Propriedade`/`PropriedadeInput` (Task 1) →
usados identicamente em `PropriedadeForm` (Task 3) e `PropriedadesPage`
(Task 5). `Talhao`/`TalhaoInput` (Task 1) → `TalhaoForm` (Task 3) →
`PropriedadesPage` (Task 5). `Cultura`/`FaseCultura` (Task 1) →
`CulturasPage` (Task 6) e `PlantioForm` (Task 4). `Plantio`/`PlantioInput`/
`PlantioStatus`/`ROTULOS_STATUS` (Task 1) → `PlantioForm` (Task 4) →
`PlantiosPage` (Task 7). Nomes de função conferidos em todas as
ocorrências (`listarPropriedades`, `criarTalhao`, `excluirPlantio`, etc.)
— sem divergência entre a task que produz e as que consomem.
