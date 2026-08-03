# Frontend: insumos + aplicações (Task #8, fatia 3a/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir as telas de Insumos (CRUD completo) e Aplicações de Insumo (criar/listar/excluir, sem editar) consumindo a API real via TanStack Query, com validação por react-hook-form + zod e tratamento de erro de mutação (setError por campo + mensagem geral).

**Architecture:** Camada `api/*.ts` fina sobre `apiRequest<T>()` (já existente) para `insumos` e `aplicacoes`, componentes de formulário (`InsumoForm`, `AplicacaoInsumoForm`) que recebem um `erro?: ApiError | null` opcional e o mapeiam para `setError` de campo/`root`, uma extensão retrocompatível de `ConfirmDialog` para exibir um erro de exclusão sem fechar o diálogo, duas páginas que orquestram `useQuery`/`useMutation`, e a extensão do roteamento/nav já existentes.

**Tech Stack:** React 19 + TypeScript + TanStack Query v5 + react-hook-form + zod + `@hookform/resolvers` (já instalados na fatia 2) + Vitest + React Testing Library + `@testing-library/user-event`.

## Global Constraints

- Contrato real do backend (confirmado lendo `lagoagro/inputs/{models,serializers,views}.py`, `lagoagro/core/urls.py`, `lagoagro/core/exceptions.py`):
  - `GET/POST/PATCH/DELETE /api/insumos/` → `{id: number, nome: string, tipo: "veneno" | "adubo", carencia_dias: number}`.
  - `GET/POST/DELETE /api/aplicacoes-insumo/` → **sem PATCH/PUT** — `{id: number, plantio: number, insumo: number, data: string ("YYYY-MM-DD"), quantidade: string}`. `quantidade` é `DecimalField`, chega/sai como **string**. `plantio`/`insumo` são IDs restritos por querysets já escopados pelo serializer.
  - Excluir um `Insumo` referenciado por alguma `AplicacaoInsumo` (FK `PROTECT`) retorna **409** com `{"detail": "Não é possível excluir: existem registros vinculados a este item."}` (handler global em `core/exceptions.py`, já existe, não muda).
  - Nenhum desses endpoints pagina resultados — toda lista é um array JSON puro.
- **Sem "Editar" para `AplicacaoInsumo`** — não existe endpoint PATCH/PUT; a UI só oferece criar e excluir.
- **Pré-checagem client-side antes de excluir um `Insumo`**: busca `useQuery(['aplicacoes'])` (cache reaproveitado se já carregada) e filtra por `insumo === id` para mostrar a contagem de uso no `ConfirmDialog`. O 409 do backend é a rede de segurança se a contagem ficar desatualizada.
- **Tratamento de erro de mutação (dívida fechada nesta fatia, só para os formulários novos)**: `InsumoForm` e `AplicacaoInsumoForm` recebem uma prop opcional `erro?: ApiError | null`; um `useEffect` mapeia `erro.body[campo]` (array de strings do DRF) para `setError(campo, {message})`, e usa `setError('root', {message})` como fallback quando nenhuma chave de campo bate. `PropriedadeForm`/`TalhaoForm`/`PlantioForm` da fatia 2 **não são tocados** nesta fatia — decisão explícita do usuário (2026-08-02).
- **`ConfirmDialog` ganha uma prop opcional `erro?: string`** (retrocompatível — usos existentes em `PropriedadesPage`/`PlantiosPage` continuam passando sem essa prop) para mostrar o erro de um 409 de exclusão sem fechar o diálogo.
- **Campos `.coerce.number()` do zod exigem a assinatura de 3 genéricos do react-hook-form** (`useForm<TInput, unknown, TOutput>` com `TInput = z.input<typeof schema>` e `TOutput = z.output<typeof schema>`) — bug já documentado na fatia 2 (`PlantioForm.tsx`): `z.coerce.number()` torna o tipo de *input* do campo `unknown` e o de *output* `number`; tipar `useForm` só com o tipo de output quebra a compatibilidade com o `Resolver` gerado por `zodResolver`. Isso se aplica aos campos `plantio`/`insumo` de `AplicacaoInsumoForm` (selects numéricos). Campos de texto numérico validados via `.string().refine(...)` (como `quantidade`, `carencia_dias`) **não** têm esse problema e não precisam da assinatura de 3 genéricos.
- **RF06/RF07 fora de escopo** — nenhum cálculo de dias-restantes/data-segura-de-colheita é exibido nesta fatia.
- **Sem filtro por plantio em `/aplicacoes`** — lista simples ordenada por data mais recente (mais recente primeiro).
- **Sem camada de hooks customizados por entidade** — mesma decisão da fatia 2.
- **Sem optimistic update** — toda mutação usa `onSuccess` para invalidar a(s) query(ies) correspondente(s).
- **Testes:** Vitest + React Testing Library + `@testing-library/user-event`.
  - Testes de `api/*.ts`: stub de `fetch` global via `vi.stubGlobal('fetch', fetchMock)` (mesmo padrão de `frontend/src/api/talhoes.test.ts`) — não usar `vi.mock('../lib/api-client')`.
  - Testes de página/formulário: `vi.mock('../api/<entidade>')` (automock), `QueryClientProvider` com `QueryClient` novo por teste (`{defaultOptions: {queries: {retry: false}}}`).
  - Quando um teste dispara mais de um `fetch` concorrente com corpos diferentes, usar `.mockImplementation(async () => new Response(...))` por chamada, não `.mockResolvedValue(...)` reaproveitando a mesma instância de `Response` (bug já documentado na fatia 2 — `Response.json()` só pode ser lido uma vez por instância).
- **Nenhuma mudança de backend nesta fatia** — os endpoints já existem e estão testados.
- Import de tipos usa `import type { X } from '...'`.

---

### Task 1: Camada de API — `api/insumos.ts`, `api/aplicacoes.ts`

**Files:**
- Create: `frontend/src/api/insumos.ts`
- Create: `frontend/src/api/insumos.test.ts`
- Create: `frontend/src/api/aplicacoes.ts`
- Create: `frontend/src/api/aplicacoes.test.ts`

**Interfaces:**
- Consumes: `apiRequest<T>(path, options?)` de `frontend/src/lib/api-client.ts:79` (já existe, não muda).
- Produces (usados pelas Tasks 3–6):
  - `TipoInsumo = 'veneno' | 'adubo'`, `Insumo = {id: number; nome: string; tipo: TipoInsumo; carencia_dias: number}`, `InsumoInput = {nome: string; tipo: TipoInsumo; carencia_dias: number}`
  - `ROTULOS_TIPO_INSUMO: Record<TipoInsumo, string>` — `{veneno: 'Veneno', adubo: 'Adubo'}`
  - `listarInsumos(): Promise<Insumo[]>`, `criarInsumo(input: InsumoInput): Promise<Insumo>`, `atualizarInsumo(id: number, input: InsumoInput): Promise<Insumo>`, `excluirInsumo(id: number): Promise<void>`
  - `AplicacaoInsumo = {id: number; plantio: number; insumo: number; data: string; quantidade: string}`, `AplicacaoInsumoInput = {plantio: number; insumo: number; data: string; quantidade: string}`
  - `listarAplicacoes(): Promise<AplicacaoInsumo[]>`, `criarAplicacao(input: AplicacaoInsumoInput): Promise<AplicacaoInsumo>`, `excluirAplicacao(id: number): Promise<void>` — **sem `atualizarAplicacao`, não existe endpoint.**

- [ ] **Step 1: Escrever `frontend/src/api/insumos.ts`**

```ts
import { apiRequest } from '../lib/api-client'

export type TipoInsumo = 'veneno' | 'adubo'

export type Insumo = {
  id: number
  nome: string
  tipo: TipoInsumo
  carencia_dias: number
}

export type InsumoInput = {
  nome: string
  tipo: TipoInsumo
  carencia_dias: number
}

export const ROTULOS_TIPO_INSUMO: Record<TipoInsumo, string> = {
  veneno: 'Veneno',
  adubo: 'Adubo',
}

export function listarInsumos(): Promise<Insumo[]> {
  return apiRequest<Insumo[]>('/insumos/')
}

export function criarInsumo(input: InsumoInput): Promise<Insumo> {
  return apiRequest<Insumo>('/insumos/', { method: 'POST', body: input })
}

export function atualizarInsumo(id: number, input: InsumoInput): Promise<Insumo> {
  return apiRequest<Insumo>(`/insumos/${id}/`, { method: 'PATCH', body: input })
}

export function excluirInsumo(id: number): Promise<void> {
  return apiRequest<void>(`/insumos/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 2: Escrever `frontend/src/api/insumos.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarInsumos, criarInsumo, atualizarInsumo, excluirInsumo } from './insumos'

describe('api/insumos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const insumo = { id: 1, nome: 'Calda bordalesa', tipo: 'veneno' as const, carencia_dias: 7 }

  it('listarInsumos faz GET /api/insumos/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([insumo]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarInsumos()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([insumo])
  })

  it('criarInsumo faz POST /api/insumos/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(insumo), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Calda bordalesa', tipo: 'veneno' as const, carencia_dias: 7 }
    const result = await criarInsumo(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(insumo)
  })

  it('atualizarInsumo faz PATCH /api/insumos/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(insumo), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await atualizarInsumo(1, { nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 10 })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/1/')
    expect(options.method).toBe('PATCH')
  })

  it('excluirInsumo faz DELETE /api/insumos/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirInsumo(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/insumos/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

Run: `cd frontend && npx vitest run src/api/insumos.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Escrever `frontend/src/api/aplicacoes.ts`**

```ts
import { apiRequest } from '../lib/api-client'

export type AplicacaoInsumo = {
  id: number
  plantio: number
  insumo: number
  data: string
  quantidade: string
}

export type AplicacaoInsumoInput = {
  plantio: number
  insumo: number
  data: string
  quantidade: string
}

export function listarAplicacoes(): Promise<AplicacaoInsumo[]> {
  return apiRequest<AplicacaoInsumo[]>('/aplicacoes-insumo/')
}

export function criarAplicacao(input: AplicacaoInsumoInput): Promise<AplicacaoInsumo> {
  return apiRequest<AplicacaoInsumo>('/aplicacoes-insumo/', { method: 'POST', body: input })
}

export function excluirAplicacao(id: number): Promise<void> {
  return apiRequest<void>(`/aplicacoes-insumo/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 4: Escrever `frontend/src/api/aplicacoes.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listarAplicacoes, criarAplicacao, excluirAplicacao } from './aplicacoes'

describe('api/aplicacoes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const aplicacao = { id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }

  it('listarAplicacoes faz GET /api/aplicacoes-insumo/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([aplicacao]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarAplicacoes()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/aplicacoes-insumo/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([aplicacao])
  })

  it('criarAplicacao faz POST /api/aplicacoes-insumo/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(aplicacao), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }
    const result = await criarAplicacao(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/aplicacoes-insumo/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual(aplicacao)
  })

  it('excluirAplicacao faz DELETE /api/aplicacoes-insumo/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirAplicacao(1)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/aplicacoes-insumo/1/')
    expect(options.method).toBe('DELETE')
  })
})
```

Run: `cd frontend && npx vitest run src/api/aplicacoes.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Rodar a suíte inteira e commitar**

Run: `cd frontend && npx vitest run src/api/insumos.test.ts src/api/aplicacoes.test.ts`
Expected: 7 passed (4+3).

```bash
git add frontend/src/api/insumos.ts frontend/src/api/insumos.test.ts frontend/src/api/aplicacoes.ts frontend/src/api/aplicacoes.test.ts
git commit -m "feat(inputs): adicionar camada de api para insumos e aplicacoes"
```

---

### Task 2: Estender `ConfirmDialog` com prop opcional `erro`

**Files:**
- Modify: `frontend/src/components/ConfirmDialog.tsx`
- Modify: `frontend/src/components/ConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces (usado pela Task 5):

```ts
type ConfirmDialogProps = {
  aberto: boolean
  titulo: string
  mensagem: string
  erro?: string
  onConfirm: () => void
  onCancel: () => void
}
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null
```

`erro` é opcional e retrocompatível — `PropriedadesPage`/`PlantiosPage` (fatia 2) continuam chamando `ConfirmDialog` sem essa prop, sem nenhuma mudança de comportamento.

- [ ] **Step 1: Adicionar aos testes existentes em `frontend/src/components/ConfirmDialog.test.tsx`**

Reescrever o arquivo inteiro com o conteúdo abaixo (mantém os 4 testes existentes e adiciona 2 novos):

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

  it('nao mostra area de erro quando erro nao e fornecido', () => {
    render(<ConfirmDialog aberto={true} titulo="t" mensagem="m" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.queryByText(/Nao e possivel/)).not.toBeInTheDocument()
  })

  it('mostra mensagem de erro quando erro e fornecido', () => {
    render(
      <ConfirmDialog
        aberto={true}
        titulo="t"
        mensagem="m"
        erro="Nao e possivel excluir: existem registros vinculados a este item."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Nao e possivel excluir: existem registros vinculados a este item.'),
    ).toBeInTheDocument()
  })
})
```

Run: `cd frontend && npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: FAIL nos 2 novos testes — `erro` ainda não é renderizado.

- [ ] **Step 2: Reescrever `frontend/src/components/ConfirmDialog.tsx`**

```tsx
type ConfirmDialogProps = {
  aberto: boolean
  titulo: string
  mensagem: string
  erro?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ aberto, titulo, mensagem, erro, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!aberto) return null

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="max-w-sm rounded bg-white p-6">
        <h2 className="mb-2 text-lg font-bold">{titulo}</h2>
        <p className="mb-4 text-sm">{mensagem}</p>
        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
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
Expected: 6 passed.

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/components/ConfirmDialog.test.tsx
git commit -m "feat(frontend): adicionar prop opcional de erro ao ConfirmDialog"
```

---

### Task 3: `InsumoForm`

**Files:**
- Create: `frontend/src/components/InsumoForm.tsx`
- Create: `frontend/src/components/InsumoForm.test.tsx`

**Interfaces:**
- Consumes: `Insumo`, `InsumoInput`, `TipoInsumo`, `ROTULOS_TIPO_INSUMO` de `frontend/src/api/insumos.ts` (Task 1); `ApiError` (tipo) de `frontend/src/lib/api-client.ts` (já existe).
- Produces (usado pela Task 5):

```ts
type InsumoFormProps = {
  insumo?: Insumo
  erro?: ApiError | null
  onSubmit: (input: InsumoInput) => void
  onCancel: () => void
}
export function InsumoForm(props: InsumoFormProps): JSX.Element
```

- [ ] **Step 1: Escrever `frontend/src/components/InsumoForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsumoForm } from './InsumoForm'
import { ApiError } from '../lib/api-client'

describe('InsumoForm', () => {
  it('chama onSubmit com os valores preenchidos, incluindo tipo e carencia_dias como numero', async () => {
    const onSubmit = vi.fn()
    render(<InsumoForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Calda bordalesa')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'adubo')
    await userEvent.clear(screen.getByLabelText('Carencia (dias)'))
    await userEvent.type(screen.getByLabelText('Carencia (dias)'), '5')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Calda bordalesa', tipo: 'adubo', carencia_dias: 5 })
  })

  it('mostra erro de validacao e nao chama onSubmit quando nome esta vazio', async () => {
    const onSubmit = vi.fn()
    render(<InsumoForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Nome e obrigatorio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando carencia_dias nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(<InsumoForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Calda bordalesa')
    await userEvent.clear(screen.getByLabelText('Carencia (dias)'))
    await userEvent.type(screen.getByLabelText('Carencia (dias)'), 'abc')
    await userEvent.click(screen.getByText('Salvar'))

    expect(
      await screen.findByText('Carencia deve ser um numero inteiro maior ou igual a zero'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula os campos quando editando um insumo existente', () => {
    const insumo = { id: 1, nome: 'Insumo existente', tipo: 'adubo' as const, carencia_dias: 3 }
    render(<InsumoForm insumo={insumo} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Insumo existente')
    expect(screen.getByLabelText('Tipo')).toHaveValue('adubo')
    expect(screen.getByLabelText('Carencia (dias)')).toHaveValue('3')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<InsumoForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Ja existe um insumo com esse nome.'] })
    render(<InsumoForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Ja existe um insumo com esse nome.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(<InsumoForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
```

Run: `cd frontend && npx vitest run src/components/InsumoForm.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/components/InsumoForm.tsx`**

```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Insumo, InsumoInput } from '../api/insumos'
import type { ApiError } from '../lib/api-client'

const schema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  tipo: z.enum(['veneno', 'adubo']),
  carencia_dias: z
    .string()
    .min(1, 'Carencia e obrigatoria')
    .refine(
      (v) => !Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0,
      'Carencia deve ser um numero inteiro maior ou igual a zero',
    ),
})

type InsumoFormValues = z.infer<typeof schema>

const CAMPOS_CONHECIDOS = ['nome', 'tipo', 'carencia_dias'] as const

type InsumoFormProps = {
  insumo?: Insumo
  erro?: ApiError | null
  onSubmit: (input: InsumoInput) => void
  onCancel: () => void
}

export function InsumoForm({ insumo, erro, onSubmit, onCancel }: InsumoFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InsumoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: insumo?.nome ?? '',
      tipo: insumo?.tipo ?? 'veneno',
      carencia_dias: insumo ? String(insumo.carencia_dias) : '0',
    },
  })

  useEffect(() => {
    if (!erro) return
    const body = erro.body as Record<string, unknown> | undefined
    let algumCampoMapeado = false
    for (const campo of CAMPOS_CONHECIDOS) {
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
  }, [erro, setError])

  function aoSubmeter(values: InsumoFormValues) {
    onSubmit({ nome: values.nome, tipo: values.tipo, carencia_dias: Number(values.carencia_dias) })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="insumo-nome" className="block text-sm">
          Nome
        </label>
        <input id="insumo-nome" {...register('nome')} className="border px-2 py-1" />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome.message}</p>}
      </div>
      <div>
        <label htmlFor="insumo-tipo" className="block text-sm">
          Tipo
        </label>
        <select id="insumo-tipo" {...register('tipo')} className="border px-2 py-1">
          <option value="veneno">Veneno</option>
          <option value="adubo">Adubo</option>
        </select>
      </div>
      <div>
        <label htmlFor="insumo-carencia" className="block text-sm">
          Carencia (dias)
        </label>
        <input id="insumo-carencia" {...register('carencia_dias')} className="border px-2 py-1" />
        {errors.carencia_dias && <p className="text-sm text-red-600">{errors.carencia_dias.message}</p>}
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

**Nota para o implementador:** `<label htmlFor="insumo-carencia">Carencia (dias)</label>` precisa do `id="insumo-carencia"` correspondente no `<input>` para `getByLabelText('Carencia (dias)')` funcionar — já está correto acima.

- [ ] **Step 3: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/components/InsumoForm.test.tsx`
Expected: 7 passed.

```bash
git add frontend/src/components/InsumoForm.tsx frontend/src/components/InsumoForm.test.tsx
git commit -m "feat(inputs): adicionar formulario de insumo com mapeamento de erro de mutacao"
```

---

### Task 4: `AplicacaoInsumoForm`

**Files:**
- Create: `frontend/src/components/AplicacaoInsumoForm.tsx`
- Create: `frontend/src/components/AplicacaoInsumoForm.test.tsx`

**Interfaces:**
- Consumes: `Insumo` de `frontend/src/api/insumos.ts`; `AplicacaoInsumoInput` de `frontend/src/api/aplicacoes.ts` (Task 1); `ApiError` (tipo) de `frontend/src/lib/api-client.ts`.
- Produces (usado pela Task 6):

```ts
export type PlantioOpcao = { id: number; label: string }

type AplicacaoInsumoFormProps = {
  plantioOpcoes: PlantioOpcao[]
  insumos: Insumo[]
  erro?: ApiError | null
  onSubmit: (input: AplicacaoInsumoInput) => void
  onCancel: () => void
}
export function AplicacaoInsumoForm(props: AplicacaoInsumoFormProps): JSX.Element
```

**Atenção:** os campos `plantio`/`insumo` usam `z.coerce.number()` — siga exatamente o padrão de 3 genéricos do `useForm` já usado em `frontend/src/components/PlantioForm.tsx` (ver Global Constraints) para não reintroduzir o erro de `tsc -b` já documentado na fatia 2.

- [ ] **Step 1: Escrever `frontend/src/components/AplicacaoInsumoForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AplicacaoInsumoForm } from './AplicacaoInsumoForm'
import type { Insumo } from '../api/insumos'
import { ApiError } from '../lib/api-client'

const plantioOpcoes = [{ id: 1, label: 'Tomate — Talhao 1 — 02/08/2026' }]
const insumos: Insumo[] = [{ id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 }]

describe('AplicacaoInsumoForm', () => {
  it('popula os selects de plantio e insumo a partir das props', () => {
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByRole('option', { name: 'Tomate — Talhao 1 — 02/08/2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Calda bordalesa' })).toBeInTheDocument()
  })

  it('chama onSubmit com os valores selecionados', async () => {
    const onSubmit = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), '2.5')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({ plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.5' })
  })

  it('mostra erro e nao chama onSubmit quando nenhum plantio e selecionado', async () => {
    const onSubmit = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), '2.5')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Selecione um plantio')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando quantidade nao e um numero valido', async () => {
    const onSubmit = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), 'abc')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Quantidade deve ser um numero maior que zero')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(
      <AplicacaoInsumoForm plantioOpcoes={plantioOpcoes} insumos={insumos} onSubmit={vi.fn()} onCancel={onCancel} />,
    )

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { quantidade: ['Quantidade invalida.'] })
    render(
      <AplicacaoInsumoForm
        plantioOpcoes={plantioOpcoes}
        insumos={insumos}
        erro={erro}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(await screen.findByText('Quantidade invalida.')).toBeInTheDocument()
  })

  it('mostra mensagem geral quando erro do backend nao bate com nenhum campo', async () => {
    const erro = new ApiError(500, 'Erro interno do servidor.', {})
    render(
      <AplicacaoInsumoForm
        plantioOpcoes={plantioOpcoes}
        insumos={insumos}
        erro={erro}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument()
  })
})
```

Run: `cd frontend && npx vitest run src/components/AplicacaoInsumoForm.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/components/AplicacaoInsumoForm.tsx`**

```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Insumo } from '../api/insumos'
import type { AplicacaoInsumoInput } from '../api/aplicacoes'
import type { ApiError } from '../lib/api-client'

export type PlantioOpcao = { id: number; label: string }

const schema = z.object({
  plantio: z.coerce.number().min(1, 'Selecione um plantio'),
  insumo: z.coerce.number().min(1, 'Selecione um insumo'),
  data: z.string().min(1, 'Data e obrigatoria'),
  quantidade: z
    .string()
    .min(1, 'Quantidade e obrigatoria')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Quantidade deve ser um numero maior que zero'),
})

// Mesmo problema de z.coerce.number() ja documentado em PlantioForm.tsx: o tipo de
// *input* do campo 'plantio'/'insumo' e `unknown`, o de *output* e `number`. Separamos
// os dois tipos e usamos a assinatura de 3 genericos do react-hook-form.
type AplicacaoInsumoFormInput = z.input<typeof schema>
type AplicacaoInsumoFormValues = z.output<typeof schema>

const CAMPOS_CONHECIDOS = ['plantio', 'insumo', 'data', 'quantidade'] as const

type AplicacaoInsumoFormProps = {
  plantioOpcoes: PlantioOpcao[]
  insumos: Insumo[]
  erro?: ApiError | null
  onSubmit: (input: AplicacaoInsumoInput) => void
  onCancel: () => void
}

export function AplicacaoInsumoForm({
  plantioOpcoes,
  insumos,
  erro,
  onSubmit,
  onCancel,
}: AplicacaoInsumoFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AplicacaoInsumoFormInput, unknown, AplicacaoInsumoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plantio: 0, insumo: 0, data: '', quantidade: '' },
  })

  useEffect(() => {
    if (!erro) return
    const body = erro.body as Record<string, unknown> | undefined
    let algumCampoMapeado = false
    for (const campo of CAMPOS_CONHECIDOS) {
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
  }, [erro, setError])

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-2">
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div>
        <label htmlFor="aplicacao-plantio" className="block text-sm">
          Plantio
        </label>
        <select id="aplicacao-plantio" {...register('plantio')} className="border px-2 py-1">
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
        <label htmlFor="aplicacao-insumo" className="block text-sm">
          Insumo
        </label>
        <select id="aplicacao-insumo" {...register('insumo')} className="border px-2 py-1">
          <option value={0}>Selecione...</option>
          {insumos.map((insumo) => (
            <option key={insumo.id} value={insumo.id}>
              {insumo.nome}
            </option>
          ))}
        </select>
        {errors.insumo && <p className="text-sm text-red-600">{errors.insumo.message}</p>}
      </div>
      <div>
        <label htmlFor="aplicacao-data" className="block text-sm">
          Data da aplicacao
        </label>
        <input id="aplicacao-data" type="date" {...register('data')} className="border px-2 py-1" />
        {errors.data && <p className="text-sm text-red-600">{errors.data.message}</p>}
      </div>
      <div>
        <label htmlFor="aplicacao-quantidade" className="block text-sm">
          Quantidade
        </label>
        <input id="aplicacao-quantidade" {...register('quantidade')} className="border px-2 py-1" />
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

- [ ] **Step 3: Rodar os testes e commitar**

Run: `cd frontend && npx vitest run src/components/AplicacaoInsumoForm.test.tsx`
Expected: 7 passed.

Se o teste de tipar a data (`userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')`) falhar por causa de como o jsdom trata `<input type="date">`, troque por `fireEvent.change(screen.getByLabelText('Data da aplicacao'), {target: {value: '2026-08-02'}})` (importar `fireEvent` de `@testing-library/react`) — mesma alternativa já usada em `PlantioForm.test.tsx` na fatia 2.

**IMPORTANTE:** rode `npx tsc -b` além dos testes antes de considerar esta task concluída — o padrão `z.coerce.number()` já causou uma falha de compilação silenciosa na fatia 2 que os testes (`vitest`) não pegaram.

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

```bash
git add frontend/src/components/AplicacaoInsumoForm.tsx frontend/src/components/AplicacaoInsumoForm.test.tsx
git commit -m "feat(inputs): adicionar formulario de aplicacao de insumo com mapeamento de erro de mutacao"
```

---

### Task 5: `InsumosPage`

**Files:**
- Create: `frontend/src/pages/InsumosPage.tsx`
- Create: `frontend/src/pages/InsumosPage.test.tsx`

**Interfaces:**
- Consumes: tudo de `frontend/src/api/insumos.ts` (Task 1); `listarAplicacoes` de `frontend/src/api/aplicacoes.ts` (Task 1); `ApiError` de `frontend/src/lib/api-client.ts`; `ConfirmDialog` (Task 2); `InsumoForm` (Task 3); `useQuery`/`useMutation`/`useQueryClient` de `@tanstack/react-query`.
- Produces: `export function InsumosPage(): JSX.Element` (usado pela Task 7 em `routes.tsx`).

- [ ] **Step 1: Escrever `frontend/src/pages/InsumosPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InsumosPage } from './InsumosPage'
import * as insumosApi from '../api/insumos'
import * as aplicacoesApi from '../api/aplicacoes'
import { ApiError } from '../lib/api-client'

vi.mock('../api/insumos')
vi.mock('../api/aplicacoes')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <InsumosPage />
    </QueryClientProvider>,
  )
}

describe('InsumosPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([])
  })

  it('lista carrega e renderiza os insumos', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])

    renderComProvider()

    expect(await screen.findByText(/Calda bordalesa/)).toBeInTheDocument()
  })

  it('criar insumo via formulario adiciona o item a lista', async () => {
    vi.mocked(insumosApi.listarInsumos)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, nome: 'Novo insumo', tipo: 'adubo', carencia_dias: 0 }])
    vi.mocked(insumosApi.criarInsumo).mockResolvedValue({ id: 1, nome: 'Novo insumo', tipo: 'adubo', carencia_dias: 0 })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Insumo'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Novo insumo')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Novo insumo/)).toBeInTheDocument()
  })

  it('excluir insumo sem aplicacoes vinculadas nao mostra aviso de uso', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    await userEvent.click(screen.getByText('Excluir'))

    expect(await screen.findByText('Tem certeza que deseja excluir este insumo?')).toBeInTheDocument()
  })

  it('excluir insumo com N aplicacoes mostra a contagem certa no dialogo', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([
      { id: 100, plantio: 1, insumo: 1, data: '2026-01-01', quantidade: '1.00' },
      { id: 101, plantio: 2, insumo: 1, data: '2026-01-02', quantidade: '2.00' },
    ])

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    await userEvent.click(screen.getByText('Excluir'))

    expect(
      await screen.findByText('Este insumo e usado em 2 aplicacao(oes) registrada(s) e nao podera ser excluido.'),
    ).toBeInTheDocument()
  })

  it('erro 409 simulado do backend aparece como mensagem no dialogo sem fecha-lo', async () => {
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([
      { id: 1, nome: 'Calda bordalesa', tipo: 'veneno', carencia_dias: 7 },
    ])
    vi.mocked(insumosApi.excluirInsumo).mockRejectedValue(
      new ApiError(409, 'Nao e possivel excluir: existem registros vinculados a este item.', {
        detail: 'Nao e possivel excluir: existem registros vinculados a este item.',
      }),
    )

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)
    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(
      await screen.findByText('Nao e possivel excluir: existem registros vinculados a este item.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('editar um insumo existente pre-popula o formulario e reflete a mudanca na lista', async () => {
    vi.mocked(insumosApi.listarInsumos)
      .mockResolvedValueOnce([{ id: 1, nome: 'Nome antigo', tipo: 'veneno', carencia_dias: 7 }])
      .mockResolvedValueOnce([{ id: 1, nome: 'Nome atualizado', tipo: 'veneno', carencia_dias: 7 }])
    vi.mocked(insumosApi.atualizarInsumo).mockResolvedValue({
      id: 1,
      nome: 'Nome atualizado',
      tipo: 'veneno',
      carencia_dias: 7,
    })

    renderComProvider()
    await screen.findByText(/Nome antigo/)
    await userEvent.click(screen.getByText('Editar'))

    expect(screen.getByLabelText('Nome')).toHaveValue('Nome antigo')

    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Nome atualizado')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Nome atualizado/)).toBeInTheDocument()
  })
})
```

Run: `cd frontend && npx vitest run src/pages/InsumosPage.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/pages/InsumosPage.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarInsumos,
  criarInsumo,
  atualizarInsumo,
  excluirInsumo,
  ROTULOS_TIPO_INSUMO,
  type Insumo,
  type InsumoInput,
} from '../api/insumos'
import { listarAplicacoes } from '../api/aplicacoes'
import { ApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InsumoForm } from '../components/InsumoForm'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; insumo: Insumo } | null

function paraApiError(erro: unknown): ApiError {
  return erro instanceof ApiError ? erro : new ApiError(0, 'Erro inesperado.')
}

export function InsumosPage() {
  const queryClient = useQueryClient()
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Insumo | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const insumosQuery = useQuery({ queryKey: ['insumos'], queryFn: listarInsumos })
  const aplicacoesQuery = useQuery({ queryKey: ['aplicacoes'], queryFn: listarAplicacoes })

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarInsumo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: InsumoInput }) => atualizarInsumo(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirInsumo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (insumosQuery.isLoading) {
    return <p>Carregando...</p>
  }

  if (insumosQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar os insumos.</p>
        <button onClick={() => insumosQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const insumos = insumosQuery.data ?? []
  const aplicacoes = aplicacoesQuery.data ?? []

  function mensagemExclusao(): string {
    if (!exclusaoPendente) return ''
    if (aplicacoesQuery.isError) {
      return 'Nao foi possivel verificar quantas aplicacoes usam este insumo. Exclua com cautela, ou tente novamente mais tarde.'
    }
    const n = aplicacoes.filter((a) => a.insumo === exclusaoPendente.id).length
    return n > 0
      ? `Este insumo e usado em ${n} aplicacao(oes) registrada(s) e nao podera ser excluido.`
      : 'Tem certeza que deseja excluir este insumo?'
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Insumos</h1>
        <button
          onClick={() => abrirFormulario({ tipo: 'novo' })}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Insumo
        </button>
      </div>

      {formulario?.tipo === 'novo' && (
        <InsumoForm
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => abrirFormulario(null)}
        />
      )}

      <ul>
        {insumos.map((insumo) =>
          formulario?.tipo === 'editar' && formulario.insumo.id === insumo.id ? (
            <li key={insumo.id} className="mb-2 border p-2">
              <InsumoForm
                insumo={insumo}
                erro={erroFormulario}
                onSubmit={(input) => atualizarMutation.mutate({ id: insumo.id, input })}
                onCancel={() => abrirFormulario(null)}
              />
            </li>
          ) : (
            <li key={insumo.id} className="mb-2 flex items-center justify-between border p-2">
              <span>
                {insumo.nome} — {ROTULOS_TIPO_INSUMO[insumo.tipo]} — carencia: {insumo.carencia_dias} dia(s)
              </span>
              <div className="flex gap-2 text-sm">
                <button onClick={() => abrirFormulario({ tipo: 'editar', insumo })}>Editar</button>
                <button
                  onClick={() => {
                    setErroExclusao(null)
                    setExclusaoPendente(insumo)
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
        titulo="Excluir insumo"
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

**Nota para o implementador:** ao contrário de `PropriedadesPage` (fatia 2), aqui `InsumoForm` de edição é renderizado dentro do próprio `<li key={insumo.id}>` de cada insumo — trocar de alvo de edição troca de `<li>` (elemento React diferente), então não há o bug de reuso de instância que exigiu `key={propriedade.id}` explícito na fatia 2. Não adicione uma prop `key` redundante no `<InsumoForm>` em si.

- [ ] **Step 3: Rodar os testes, `tsc -b` e commitar**

Run: `cd frontend && npx vitest run src/pages/InsumosPage.test.tsx`
Expected: 6 passed.

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

```bash
git add frontend/src/pages/InsumosPage.tsx frontend/src/pages/InsumosPage.test.tsx
git commit -m "feat(inputs): adicionar InsumosPage com pre-checagem de uso antes de excluir"
```

---

### Task 6: `AplicacoesPage`

**Files:**
- Create: `frontend/src/pages/AplicacoesPage.tsx`
- Create: `frontend/src/pages/AplicacoesPage.test.tsx`

**Interfaces:**
- Consumes: tudo de `frontend/src/api/aplicacoes.ts` (Task 1); `listarPlantios` de `frontend/src/api/plantios.ts`, `listarTalhoes` de `frontend/src/api/talhoes.ts`, `listarCulturas` de `frontend/src/api/culturas.ts` (fatia 2, já existem); `listarInsumos` de `frontend/src/api/insumos.ts` (Task 1); `ApiError` de `frontend/src/lib/api-client.ts`; `ConfirmDialog` (Task 2); `AplicacaoInsumoForm`, `PlantioOpcao` (Task 4).
- Produces: `export function AplicacoesPage(): JSX.Element` (usado pela Task 7 em `routes.tsx`).

- [ ] **Step 1: Escrever `frontend/src/pages/AplicacoesPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AplicacoesPage } from './AplicacoesPage'
import * as aplicacoesApi from '../api/aplicacoes'
import * as plantiosApi from '../api/plantios'
import * as talhoesApi from '../api/talhoes'
import * as culturasApi from '../api/culturas'
import * as insumosApi from '../api/insumos'

vi.mock('../api/aplicacoes')
vi.mock('../api/plantios')
vi.mock('../api/talhoes')
vi.mock('../api/culturas')
vi.mock('../api/insumos')

const talhao = { id: 1, propriedade: 1, nome: 'Talhao 1', area: '2.50', tipo_solo: 'Argiloso' }
const cultura = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [] }
const plantio = { id: 1, talhao: 1, cultura: 1, data_plantio: '2026-08-02', status: 'em_andamento' as const }
const insumo = { id: 1, nome: 'Calda bordalesa', tipo: 'veneno' as const, carencia_dias: 7 }

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AplicacoesPage />
    </QueryClientProvider>,
  )
}

describe('AplicacoesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(plantiosApi.listarPlantios).mockResolvedValue([plantio])
    vi.mocked(talhoesApi.listarTalhoes).mockResolvedValue([talhao])
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([cultura])
    vi.mocked(insumosApi.listarInsumos).mockResolvedValue([insumo])
  })

  it('selects de plantio e insumo sao populados com os labels reconstruidos certos', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([])

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Aplicação'))

    expect(screen.getByRole('option', { name: /Tomate — Talhao 1 — 02\/08\/2026/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Calda bordalesa' })).toBeInTheDocument()
  })

  it('criar aplicacao via formulario adiciona o item a lista com os labels certos', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }])
    vi.mocked(aplicacoesApi.criarAplicacao).mockResolvedValue({
      id: 1,
      plantio: 1,
      insumo: 1,
      data: '2026-08-02',
      quantidade: '2.50',
    })

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Aplicação'))
    await userEvent.selectOptions(screen.getByLabelText('Plantio'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Insumo'), '1')
    await userEvent.type(screen.getByLabelText('Data da aplicacao'), '2026-08-02')
    await userEvent.type(screen.getByLabelText('Quantidade'), '2.50')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText(/Calda bordalesa/)).toBeInTheDocument()
    expect(screen.getByText(/Tomate — Talhao 1/)).toBeInTheDocument()
  })

  it('nenhum botao Editar esta presente na pagina', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes).mockResolvedValue([
      { id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' },
    ])

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
  })

  it('excluir aplicacao remove o item da lista', async () => {
    vi.mocked(aplicacoesApi.listarAplicacoes)
      .mockResolvedValueOnce([{ id: 1, plantio: 1, insumo: 1, data: '2026-08-02', quantidade: '2.50' }])
      .mockResolvedValueOnce([])
    vi.mocked(aplicacoesApi.excluirAplicacao).mockResolvedValue(undefined)

    renderComProvider()
    await screen.findByText(/Calda bordalesa/)

    await userEvent.click(screen.getByText('Excluir'))
    await userEvent.click(screen.getByText('Confirmar'))

    expect(screen.queryByText(/Calda bordalesa/)).not.toBeInTheDocument()
  })
})
```

Run: `cd frontend && npx vitest run src/pages/AplicacoesPage.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 2: Escrever `frontend/src/pages/AplicacoesPage.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listarAplicacoes, criarAplicacao, excluirAplicacao, type AplicacaoInsumo } from '../api/aplicacoes'
import { listarPlantios } from '../api/plantios'
import { listarTalhoes } from '../api/talhoes'
import { listarCulturas } from '../api/culturas'
import { listarInsumos } from '../api/insumos'
import { ApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AplicacaoInsumoForm } from '../components/AplicacaoInsumoForm'

function paraApiError(erro: unknown): ApiError {
  return erro instanceof ApiError ? erro : new ApiError(0, 'Erro inesperado.')
}

export function AplicacoesPage() {
  const queryClient = useQueryClient()
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<AplicacaoInsumo | null>(null)

  const aplicacoesQuery = useQuery({ queryKey: ['aplicacoes'], queryFn: listarAplicacoes })
  const plantiosQuery = useQuery({ queryKey: ['plantios'], queryFn: listarPlantios })
  const talhoesQuery = useQuery({ queryKey: ['talhoes'], queryFn: listarTalhoes })
  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })
  const insumosQuery = useQuery({ queryKey: ['insumos'], queryFn: listarInsumos })

  const criarMutation = useMutation({
    mutationFn: criarAplicacao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aplicacoes'] })
      setErroFormulario(null)
      setFormularioAberto(false)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirAplicacao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aplicacoes'] })
      setExclusaoPendente(null)
    },
  })

  if (
    aplicacoesQuery.isLoading ||
    plantiosQuery.isLoading ||
    talhoesQuery.isLoading ||
    culturasQuery.isLoading ||
    insumosQuery.isLoading
  ) {
    return <p>Carregando...</p>
  }

  if (aplicacoesQuery.isError) {
    return (
      <div>
        <p>Nao foi possivel carregar as aplicacoes.</p>
        <button onClick={() => aplicacoesQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const aplicacoes = aplicacoesQuery.data ?? []
  const plantios = plantiosQuery.data ?? []
  const talhoes = talhoesQuery.data ?? []
  const culturas = culturasQuery.data ?? []
  const insumos = insumosQuery.data ?? []

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
  function nomeInsumo(id: number): string {
    return insumos.find((i) => i.id === id)?.nome ?? '—'
  }

  const plantioOpcoes = plantios.map((plantio) => ({ id: plantio.id, label: labelPlantio(plantio.id) }))
  const aplicacoesOrdenadas = [...aplicacoes].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Aplicações</h1>
        <button
          onClick={() => {
            setErroFormulario(null)
            setFormularioAberto(true)
          }}
          className="rounded bg-green-700 px-3 py-1 text-sm text-white"
        >
          + Aplicação
        </button>
      </div>

      {formularioAberto && (
        <AplicacaoInsumoForm
          plantioOpcoes={plantioOpcoes}
          insumos={insumos}
          erro={erroFormulario}
          onSubmit={(input) => criarMutation.mutate(input)}
          onCancel={() => {
            setErroFormulario(null)
            setFormularioAberto(false)
          }}
        />
      )}

      <ul>
        {aplicacoesOrdenadas.map((aplicacao) => (
          <li key={aplicacao.id} className="mb-2 flex items-center justify-between border p-2">
            <span>
              {labelPlantio(aplicacao.plantio)} — {nomeInsumo(aplicacao.insumo)} —{' '}
              {new Date(`${aplicacao.data}T00:00:00`).toLocaleDateString('pt-BR')} — {aplicacao.quantidade}
            </span>
            <button onClick={() => setExclusaoPendente(aplicacao)} className="text-sm">
              Excluir
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir aplicação"
        mensagem="Tem certeza que deseja excluir esta aplicação?"
        onConfirm={() => {
          if (exclusaoPendente) excluirMutation.mutate(exclusaoPendente.id)
        }}
        onCancel={() => setExclusaoPendente(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Rodar os testes, `tsc -b` e commitar**

Run: `cd frontend && npx vitest run src/pages/AplicacoesPage.test.tsx`
Expected: 4 passed.

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

```bash
git add frontend/src/pages/AplicacoesPage.tsx frontend/src/pages/AplicacoesPage.test.tsx
git commit -m "feat(inputs): adicionar AplicacoesPage (criar, listar, excluir)"
```

---

### Task 7: Roteamento e navegação

**Files:**
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/layout/AppShell.tsx`
- Modify: `frontend/src/routes.test.tsx`

**Interfaces:**
- Consumes: `InsumosPage` (Task 5), `AplicacoesPage` (Task 6).
- Produces: nada consumido por outras tasks — última task da fatia.

- [ ] **Step 1: Adicionar testes de navegação em `frontend/src/routes.test.tsx`**

Adicionar os dois testes abaixo dentro do `describe('navegacao para as paginas de cadastro', ...)` já existente, depois do teste de "Plantios" (não remover nenhum teste existente):

```tsx
  it('link de Insumos navega para a pagina de insumos', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // InsumosPage dispara 2 fetches paralelos (insumos/aplicacoes); mesmo motivo dos
      // testes de Propriedades/Plantios acima: mockImplementation evita reusar a mesma
      // instancia de Response entre chamadas concorrentes.
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 })) // insumos/aplicacoes
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Insumos' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Insumos' })).toBeInTheDocument())
  })

  it('link de Aplicacoes navega para a pagina de aplicacoes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      // AplicacoesPage dispara 5 fetches paralelos (aplicacoes/plantios/talhoes/culturas/insumos).
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Aplicações' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Aplicações' })).toBeInTheDocument())
  })
```

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: FAIL nos 2 novos testes — rotas/links ainda não existem.

- [ ] **Step 2: Adicionar as rotas em `frontend/src/routes.tsx`**

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { PropriedadesPage } from './pages/PropriedadesPage'
import { CulturasPage } from './pages/CulturasPage'
import { PlantiosPage } from './pages/PlantiosPage'
import { InsumosPage } from './pages/InsumosPage'
import { AplicacoesPage } from './pages/AplicacoesPage'

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
  {
    path: '/insumos',
    element: (
      <ProtectedRoute>
        <AppShell>
          <InsumosPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  {
    path: '/aplicacoes',
    element: (
      <ProtectedRoute>
        <AppShell>
          <AplicacoesPage />
        </AppShell>
      </ProtectedRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
```

- [ ] **Step 3: Adicionar os links de nav em `frontend/src/layout/AppShell.tsx`**

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
            <Link to="/insumos">Insumos</Link>
            <Link to="/aplicacoes">Aplicações</Link>
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

- [ ] **Step 4: Rodar a suíte inteira, `tsc -b` e commitar**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: todos passando (3 do describe de login/logout + 5 do describe de navegação).

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

```bash
git add frontend/src/routes.tsx frontend/src/layout/AppShell.tsx frontend/src/routes.test.tsx
git commit -m "feat(frontend): adicionar rotas e navegacao para insumos e aplicacoes"
```

---

### Task Final: Suíte completa

- [ ] **Step 1: Rodar toda a suíte de testes do frontend**

Run: `cd frontend && npx vitest run`
Expected: todos os testes passando (fatias 1, 2 e 3a juntas).

- [ ] **Step 2: Rodar `tsc -b` no projeto inteiro**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.
