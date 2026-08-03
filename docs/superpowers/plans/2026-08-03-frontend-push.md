# Frontend: fluxo de push (Task #8, fatia 3c/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last gap in RF11 (web push): expose the VAPID public key, let the user grant browser permission and subscribe, and make the service worker show/open the notification.

**Architecture:** One new, unauthenticated Django view exposing a config value; a thin `api/push.ts` wrapper; a `lib/push.ts` orchestration module that turns the whole permission→subscribe→register flow into a single function returning a typed result (never throwing); an "Ativar notificações" button in `AppShell`; two new listeners in `sw.ts`.

**Tech Stack:** Django REST Framework (backend), React 19 + TypeScript, Vitest + React Testing Library, native browser Push API / Notification API / Service Worker API (no new dependency).

## Global Constraints

- Backend contract (confirmed in `lagoagro/notifications/`): `PushSubscription` already has full `list/create/retrieve/destroy` at `/api/push-subscriptions/` (no update/partial_update, by design). `settings.VAPID_PUBLIC_KEY` already exists (env var, default `''`). No change to `services.py`'s push payload (`{"title": ..., "body": ...}`, no URL field) — `notificationclick` always opens `/`.
- New endpoint: `GET /api/notificacoes/chave-publica/` — `AllowAny`, no JWT required (the public half of a VAPID key pair is not a secret). Returns `{"public_key": settings.VAPID_PUBLIC_KEY}`, which is `{"public_key": ""}` when not configured (not an error).
- Backend tests run via `pytest` from the `lagoagro/` directory (`DJANGO_SETTINGS_MODULE=core.settings`, `testpaths=["tests"]`, confirmed in `pyproject.toml`). Frontend tests via `npx vitest run` from `frontend/`; `npx tsc -b` from `frontend/` must be clean before any task is reported done.
- Only ADD the "ativar" flow — no unsubscribe/toggle in this fatia. The button becomes static text "Notificações ativadas" after a successful subscribe; it stays visible (retryable) after `'negado'`/`'indisponivel'`/`'erro'`.
- The button in `AppShell` must NOT render at all when the browser doesn't support Push (`'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window` is false) — no dead action exposed.
- `sw.ts` gets no unit test — same convention already in place since fatia 1 (the file has zero tests today); verified only via `tsc -b`. This is a deliberate, already-documented decision, not a coverage gap to fix.
- `frontend/tsconfig.app.json` already includes `"lib": ["ES2023", "DOM"]` — `Notification`, `PushManager`, `ServiceWorkerRegistration`, `PushSubscription` (the DOM interface) are all ambient types already available; do not add any `@types/*` package. Our own input type is named `PushSubscriptionInput`, not `PushSubscription`, specifically to avoid colliding with the DOM's global `PushSubscription` interface.
- `verbatimModuleSyntax: true` — use `import type { ... }` for type-only imports, matching every existing file in the codebase.

---

### Task 1: Backend — `VapidPublicKeyView`

**Files:**
- Modify: `lagoagro/notifications/views.py`
- Modify: `lagoagro/core/urls.py`
- Modify: `lagoagro/tests/test_notifications_views.py`

**Interfaces:**
- Produces: `GET /api/notificacoes/chave-publica/` → `200 {"public_key": str}`, no authentication required. No later task in this plan consumes this via Python — Task 2 (frontend) consumes it as an HTTP endpoint, by URL string only.

- [ ] **Step 1: Write the failing tests**

Append to `lagoagro/tests/test_notifications_views.py` (all imports it needs — `APIClient` — are already imported at the top of the file):

```python
def test_chave_publica_retorna_a_chave_configurada(settings):
    settings.VAPID_PUBLIC_KEY = "chave-publica-de-teste"
    client = APIClient()

    response = client.get("/api/notificacoes/chave-publica/")

    assert response.status_code == 200
    assert response.data["public_key"] == "chave-publica-de-teste"


def test_chave_publica_retorna_vazio_quando_nao_configurada(settings):
    settings.VAPID_PUBLIC_KEY = ""
    client = APIClient()

    response = client.get("/api/notificacoes/chave-publica/")

    assert response.status_code == 200
    assert response.data["public_key"] == ""


def test_chave_publica_nao_exige_autenticacao():
    client = APIClient()

    response = client.get("/api/notificacoes/chave-publica/")

    assert response.status_code == 200
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd lagoagro && pytest tests/test_notifications_views.py -k chave_publica -v`
Expected: FAIL — `404 Not Found` (the route doesn't exist yet).

- [ ] **Step 3: Add the view**

In `lagoagro/notifications/views.py`, add this class at the end of the file (all its imports — `settings`, `APIView`, `AllowAny`, `Response` — are already imported at the top of this file):

```python
class VapidPublicKeyView(APIView):
    """Expoe a metade publica do par de chaves VAPID (ADR 005) - nao e
    segredo por definicao, entao nao exige autenticacao."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"public_key": settings.VAPID_PUBLIC_KEY})
```

- [ ] **Step 4: Wire the route**

In `lagoagro/core/urls.py`, change the existing import line:
```python
from notifications.views import DispararNotificacoesView, PushSubscriptionViewSet
```
to:
```python
from notifications.views import DispararNotificacoesView, PushSubscriptionViewSet, VapidPublicKeyView
```

Then add this line to `urlpatterns`, right after the `notificacoes-disparar` path:
```python
    path('api/notificacoes/chave-publica/', VapidPublicKeyView.as_view(), name='notificacoes-chave-publica'),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd lagoagro && pytest tests/test_notifications_views.py -k chave_publica -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full backend suite**

Run: `cd lagoagro && pytest`
Expected: all tests pass (this file's other tests, and the rest of the suite, unaffected).

- [ ] **Step 7: Commit**

```bash
git add lagoagro/notifications/views.py lagoagro/core/urls.py lagoagro/tests/test_notifications_views.py
git commit -m "feat(notifications): adicionar endpoint publico de chave VAPID"
```

---

### Task 2: `api/push.ts` — API layer

**Files:**
- Create: `frontend/src/api/push.ts`
- Create: `frontend/src/api/push.test.ts`

**Interfaces:**
- Produces: `type PushSubscriptionInput = {endpoint: string; p256dh: string; auth: string}`, `obterChavePublicaVapid(): Promise<{public_key: string}>`, `registrarPushSubscription(input: PushSubscriptionInput): Promise<{id: number}>`. Task 3 (`lib/push.ts`) consumes both functions.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/api/push.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { obterChavePublicaVapid, registrarPushSubscription } from './push'

describe('api/push', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('obterChavePublicaVapid faz GET /api/notificacoes/chave-publica/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ public_key: 'chave-123' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await obterChavePublicaVapid()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/notificacoes/chave-publica/')
    expect(options.method).toBe('GET')
    expect(result).toEqual({ public_key: 'chave-123' })
  })

  it('registrarPushSubscription faz POST /api/push-subscriptions/ com o corpo certo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { endpoint: 'https://push.example/1', p256dh: 'chave-p256dh', auth: 'chave-auth' }
    const result = await registrarPushSubscription(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/push-subscriptions/')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(input))
    expect(result).toEqual({ id: 1 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/push.test.ts`
Expected: FAIL — `Failed to resolve import "./push"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/api/push.ts`:

```ts
import { apiRequest } from '../lib/api-client'

export function obterChavePublicaVapid(): Promise<{ public_key: string }> {
  return apiRequest<{ public_key: string }>('/notificacoes/chave-publica/')
}

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export function registrarPushSubscription(input: PushSubscriptionInput): Promise<{ id: number }> {
  return apiRequest<{ id: number }>('/push-subscriptions/', { method: 'POST', body: input })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/push.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/push.ts frontend/src/api/push.test.ts
git commit -m "feat(frontend): adicionar api layer de push (chave vapid, registrar subscription)"
```

---

### Task 3: `lib/push.ts` — browser orchestration

**Files:**
- Create: `frontend/src/lib/push.ts`
- Create: `frontend/src/lib/push.test.ts`

**Interfaces:**
- Consumes: `obterChavePublicaVapid`, `registrarPushSubscription` from `../api/push` (Task 2).
- Produces: `type ResultadoAtivacao = 'ativado' | 'negado' | 'indisponivel'`, `suportaPush(): boolean`, `ativarNotificacoes(): Promise<ResultadoAtivacao>`. Task 4 (`AppShell.tsx`) consumes both.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/lib/push.test.ts`. jsdom does not implement `Notification`/`PushManager`/`navigator.serviceWorker` by default, so the "unsupported" tests need zero setup — only the "supported" tests need to stub these globals:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { suportaPush, ativarNotificacoes } from './push'
import * as pushApi from '../api/push'

vi.mock('../api/push')

function definirServiceWorkerMock(resolverSubscribe: () => Promise<{ toJSON: () => unknown }>) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve({
        pushManager: { subscribe: vi.fn(resolverSubscribe) },
      }),
    },
    configurable: true,
  })
}

function removerServiceWorkerMock() {
  // @ts-expect-error apagando propriedade de teste que nao existe por padrao no jsdom
  delete navigator.serviceWorker
}

describe('suportaPush', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    removerServiceWorkerMock()
  })

  it('retorna false quando as APIs de push nao existem (padrao do jsdom, sem stub nenhum)', () => {
    expect(suportaPush()).toBe(false)
  })

  it('retorna true quando serviceWorker, PushManager e Notification existem', () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn() })
    definirServiceWorkerMock(async () => ({ toJSON: () => ({}) }))

    expect(suportaPush()).toBe(true)
  })
})

describe('ativarNotificacoes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    removerServiceWorkerMock()
  })

  it('retorna "indisponivel" quando o navegador nao suporta push', async () => {
    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('indisponivel')
  })

  it('retorna "negado" quando a permissao nao e concedida', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') })
    definirServiceWorkerMock(async () => ({ toJSON: () => ({}) }))

    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('negado')
  })

  it('retorna "indisponivel" quando a chave publica vem vazia', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    definirServiceWorkerMock(async () => ({ toJSON: () => ({}) }))
    vi.mocked(pushApi.obterChavePublicaVapid).mockResolvedValue({ public_key: '' })

    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('indisponivel')
  })

  it('assina e registra no backend quando tudo da certo, retornando "ativado"', async () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    definirServiceWorkerMock(async () => ({
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p256dh-valor', auth: 'auth-valor' } }),
    }))
    vi.mocked(pushApi.obterChavePublicaVapid).mockResolvedValue({ public_key: 'QUJD' })
    vi.mocked(pushApi.registrarPushSubscription).mockResolvedValue({ id: 1 })

    const resultado = await ativarNotificacoes()

    expect(resultado).toBe('ativado')
    expect(pushApi.registrarPushSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh-valor',
      auth: 'auth-valor',
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/push.test.ts`
Expected: FAIL — `Failed to resolve import "./push"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/push.ts`:

```ts
import { obterChavePublicaVapid, registrarPushSubscription } from '../api/push'

export type ResultadoAtivacao = 'ativado' | 'negado' | 'indisponivel'

export function suportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function ativarNotificacoes(): Promise<ResultadoAtivacao> {
  if (!suportaPush()) return 'indisponivel'

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return 'negado'

  const { public_key } = await obterChavePublicaVapid()
  if (!public_key) return 'indisponivel'

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(public_key),
  })
  const json = subscription.toJSON()
  await registrarPushSubscription({
    endpoint: json.endpoint ?? '',
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  })
  return 'ativado'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/push.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/push.ts frontend/src/lib/push.test.ts
git commit -m "feat(frontend): adicionar orquestracao do fluxo de ativacao de push"
```

---

### Task 4: `AppShell.tsx` — botão "Ativar notificações"

**Files:**
- Modify: `frontend/src/layout/AppShell.tsx`
- Create: `frontend/src/layout/AppShell.test.tsx`

**Interfaces:**
- Consumes: `suportaPush`, `ativarNotificacoes` from `../lib/push` (Task 3); `useAuth` from `../auth/AuthContext` (existing, unchanged).

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/layout/AppShell.test.tsx`. `AppShell` renders `<Link>`, so it needs a Router context — wrap in `MemoryRouter`, not the app's real `router` (this test is isolated, not an integration test through `routes.tsx`):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import * as pushLib from '../lib/push'
import * as authContext from '../auth/AuthContext'

vi.mock('../lib/push')
vi.mock('../auth/AuthContext')

function renderComProviders() {
  return render(
    <MemoryRouter>
      <AppShell>
        <p>conteudo</p>
      </AppShell>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(authContext.useAuth).mockReturnValue({
      usuario: { id: 1, username: 'produtor1' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('nao mostra o botao de notificacoes quando o navegador nao suporta push', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)

    renderComProviders()

    expect(screen.queryByText('Ativar notificações')).not.toBeInTheDocument()
  })

  it('clique bem-sucedido troca o botao por "Notificações ativadas"', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(true)
    vi.mocked(pushLib.ativarNotificacoes).mockResolvedValue('ativado')

    renderComProviders()
    await userEvent.click(screen.getByText('Ativar notificações'))

    expect(await screen.findByText('Notificações ativadas')).toBeInTheDocument()
    expect(screen.queryByText('Ativar notificações')).not.toBeInTheDocument()
  })

  it('permissao negada mostra a mensagem certa e mantem o botao', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(true)
    vi.mocked(pushLib.ativarNotificacoes).mockResolvedValue('negado')

    renderComProviders()
    await userEvent.click(screen.getByText('Ativar notificações'))

    expect(
      await screen.findByText('Permissão negada — ative nas configurações do navegador.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ativar notificações')).toBeInTheDocument()
  })

  it('chave vazia mostra mensagem de indisponivel', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(true)
    vi.mocked(pushLib.ativarNotificacoes).mockResolvedValue('indisponivel')

    renderComProviders()
    await userEvent.click(screen.getByText('Ativar notificações'))

    expect(await screen.findByText('Notificações indisponíveis neste ambiente.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/layout/AppShell.test.tsx`
Expected: FAIL — no element with text "Ativar notificações" exists yet.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `frontend/src/layout/AppShell.tsx`:

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { suportaPush, ativarNotificacoes } from '../lib/push'

type EstadoNotificacoes = 'idle' | 'carregando' | 'ativado' | 'negado' | 'indisponivel' | 'erro'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()
  const [estadoNotificacoes, setEstadoNotificacoes] = useState<EstadoNotificacoes>('idle')

  async function aoClicarAtivarNotificacoes() {
    setEstadoNotificacoes('carregando')
    try {
      const resultado = await ativarNotificacoes()
      setEstadoNotificacoes(resultado)
    } catch {
      setEstadoNotificacoes('erro')
    }
  }

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
            <Link to="/tarefas">Tarefas</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {suportaPush() && estadoNotificacoes !== 'ativado' && (
            <button onClick={aoClicarAtivarNotificacoes} disabled={estadoNotificacoes === 'carregando'}>
              {estadoNotificacoes === 'carregando' ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}
          {estadoNotificacoes === 'ativado' && <span>Notificações ativadas</span>}
          {estadoNotificacoes === 'negado' && (
            <span className="text-red-600">Permissão negada — ative nas configurações do navegador.</span>
          )}
          {estadoNotificacoes === 'indisponivel' && (
            <span className="text-red-600">Notificações indisponíveis neste ambiente.</span>
          )}
          {estadoNotificacoes === 'erro' && (
            <span className="text-red-600">Não foi possível ativar notificações agora.</span>
          )}
          <button onClick={() => logout()}>Sair</button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/layout/AppShell.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Run `routes.test.tsx` to confirm the nav/logout tests still pass**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: PASS, unchanged. `routes.test.tsx` renders the real `App`/`router`, not a mock of `lib/push` — so `suportaPush()` there runs for real against jsdom, which doesn't implement `PushManager`/`Notification`/`serviceWorker`, so it returns `false` and the button never renders in those tests. This is expected: no new fetch call is introduced by `AppShell` in the full-app integration tests.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layout/AppShell.tsx frontend/src/layout/AppShell.test.tsx
git commit -m "feat(frontend): adicionar botao de ativar notificacoes no AppShell"
```

---

### Task 5: `sw.ts` — handlers de `push` e `notificationclick`

**Files:**
- Modify: `frontend/src/sw.ts`

**Interfaces:**
- None — this file is the service worker entry point, not imported by any other module in this plan.

- [ ] **Step 1: Add the listeners**

Replace the comment block in `frontend/src/sw.ts` that currently reads:

```ts
// Handlers de 'push' e 'notificationclick' (ADR 005) sao adicionados numa
// fatia futura, quando a UI de tarefas existir pra mostrar o que a
// notificacao abre - ver docs/superpowers/specs/2026-08-01-frontend-scaffold-auth-design.md.
```

with:

```ts
self.addEventListener('push', (event) => {
  const dados = event.data?.json() ?? {}
  const title = dados.title ?? 'LagoAgro'
  event.waitUntil(self.registration.showNotification(title, { body: dados.body ?? '' }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
```

The rest of the file (the `precacheAndRoute` call above, and the "navegacao offline" comment below) stays exactly as-is.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: no errors. (No unit test for this file — see Global Constraints.)

- [ ] **Step 3: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: every test file passes (this is the last task in the plan — nothing should be left broken).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/sw.ts
git commit -m "feat(frontend): adicionar handlers de push e notificationclick no service worker"
```

---

## Post-plan: whole-branch review

After all 5 tasks are committed, run the final whole-branch review (per `superpowers:subagent-driven-development`) covering the full diff against `master`, with special attention to:

- The button in `AppShell` genuinely never renders when `suportaPush()` is false — confirm no code path bypasses that gate.
- `ativarNotificacoes()` never throws to its caller for any of the expected failure modes (unsupported, denied, empty key) — only a genuine unexpected error (e.g. network failure registering the subscription) should reach `AppShell`'s `catch`.
- The backend endpoint truly requires no authentication and returns `200` even with an empty key (not `500`/`404`).
- `sw.ts`'s `tsc -b` cleanliness (its only verification, per the documented no-test decision).
