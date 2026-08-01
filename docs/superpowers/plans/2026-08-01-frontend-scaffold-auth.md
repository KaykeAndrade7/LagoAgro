# Frontend: Scaffold + Autenticação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the frontend project (Vite + React + TypeScript + Tailwind, PWA-ready) with a working JWT auth flow against the real backend contract — login, silent session restore on reload, refresh-on-401, logout — landing on a placeholder authenticated dashboard.

**Architecture:** `frontend/` is a new top-level directory, a separate npm project from `lagoagro/`. The access token lives only in memory (a React context), never in storage; the refresh token is the httpOnly cookie the backend already sets. A typed `fetch` wrapper (`lib/api-client.ts`) centralizes auth-header injection and the refresh-on-401 retry so every future domain page (fatias 2-4) gets that behavior for free. One small backend addition (`GET /api/auth/me/`) closes a real gap in the existing auth contract — `POST /api/auth/refresh/` returns only `{access}`, with no user info, which the original design didn't account for.

**Tech Stack:** Vite, React 18/19 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), `react-router-dom` (`createBrowserRouter`/`RouterProvider`), `@tanstack/react-query` v5, Vitest + React Testing Library, `vite-plugin-pwa`. Full spec: `docs/superpowers/specs/2026-08-01-frontend-scaffold-auth-design.md`.

## Global Constraints

- Access token in memory only (a module-level variable inside `lib/api-client.ts`, exposed via `setAccessToken`/read internally) — never `localStorage`/`sessionStorage`. The refresh token is the backend's httpOnly `refresh` cookie; frontend code never reads or writes it directly.
- Every `fetch` call goes through `lib/api-client.ts`'s `apiRequest`, never a bare `fetch` call elsewhere in the app — this is what makes the refresh-on-401 behavior universal.
- On a non-refresh-endpoint 401, retry exactly once after a successful refresh. If refresh itself fails, throw `AuthExpiredError` and do not retry again.
- Backend contract (do not restate as a task requirement without this — it's already true today, verify, don't reinvent): `POST /api/auth/login/` → `{access, user: {id, username}}` + `refresh` cookie. `POST /api/auth/refresh/` → `{access}` + rotated `refresh` cookie, reads the cookie itself (no body). `POST /api/auth/logout/` → 200, invalidates + clears the cookie, idempotent even with no cookie. This plan adds `GET /api/auth/me/` → `{id, username}` for the authenticated user (JWT-protected, same as every domain endpoint).
- Dev-mode CORS is avoided via a Vite proxy (`/api/*` → `http://localhost:8000`), not `django-cors-headers` — that stays deferred to Task #9.
- Test files: backend test for the new endpoint goes in `lagoagro/tests/test_auth.py` (existing file, matches its established `_criar_usuario()` helper and `APIClient()` pattern). Frontend tests live next to the file they test (`api-client.test.ts` beside `api-client.ts`), Vitest + React Testing Library.
- All frontend commands in this plan assume the working directory is `frontend/`. All backend commands assume `lagoagro/` and use `uv run ...`, matching every prior plan in this project.
- Conventional Commits: this plan's frontend commits use a new scope, `frontend` (add it to `CLAUDE.md`'s valid-scopes list in Task 1, the same way the `notifications` scope was added when that app was created). The one backend task in this plan (Task 2) uses scope `auth`, matching the existing scope already used for `core/auth_views.py` work.

---

### Task 1: Project scaffold — Vite + React + TypeScript + Tailwind v4 + Vitest/RTL

**Files:**
- Create: `frontend/` (entire Vite-generated project structure)
- Modify: `CLAUDE.md` (add `frontend` to valid commit scopes, add one line to "Estrutura de pastas" noting the new top-level `frontend/` directory)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working Vite dev server, a working `npm run build`, a working `npm test` (Vitest), Tailwind utility classes that actually apply, and React Testing Library wired up. Every later task in this plan runs `npm test`/`npm run build` inside this scaffold.

- [ ] **Step 1: Scaffold the Vite project**

From the repo root (`C:\Users\Kayke Andrade\Desktop\LagoAgro`):
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```
Expected: `frontend/` now contains a standard Vite React+TS scaffold (`src/main.tsx`, `src/App.tsx`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, etc.) and `npm install` completes with no errors.

- [ ] **Step 2: Verify the default scaffold runs and builds**

From `frontend/`:
```bash
npm run build
```
Expected: build succeeds, produces `dist/`. This is the baseline sanity check before adding anything — if this fails, stop and report rather than building on a broken scaffold.

- [ ] **Step 3: Install and configure Tailwind CSS v4**

```bash
npm install tailwindcss @tailwindcss/vite
```
In `vite.config.ts`, add the Tailwind plugin alongside the existing React plugin:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```
In `src/index.css` (created by the scaffold — replace its contents entirely, don't append):
```css
@import "tailwindcss";
```
Confirm `src/main.tsx` already imports `./index.css` (the Vite React+TS template does this by default — if it doesn't, add `import './index.css'` as the first import).

**If `npm install tailwindcss` resolves to a `3.x` version** (check `frontend/node_modules/tailwindcss/package.json`'s `"version"` field, or the version npm prints during install): stop here and report `NEEDS_CONTEXT` rather than guessing — Tailwind v3's setup is a `tailwind.config.js` + `postcss.config.js` + different `@tailwind` directives, a different shape than what this step assumes. Do not silently adapt; the exact v3 steps need to be decided before continuing, since this establishes the project's convention for four more frontend slices.

- [ ] **Step 4: Prove Tailwind actually applies (smoke test, not just "build succeeds")**

Replace `src/App.tsx` with:
```tsx
function App() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">LagoAgro</h1>
    </div>
  )
}

export default App
```

- [ ] **Step 5: Install Vitest + React Testing Library**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

Add a `vitest.config.ts` at `frontend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

Create `frontend/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

Add a `test` script to `frontend/package.json`'s `"scripts"` block: `"test": "vitest run"`.

- [ ] **Step 6: Write the scaffold smoke test**

```tsx
// frontend/src/App.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renderiza o titulo', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'LagoAgro' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run the test suite and the build**

Run: `npm test`
Expected: 1 passed.

Run: `npm run build`
Expected: succeeds (proves Tailwind's Vite plugin doesn't break production builds).

Run: `npm run dev`, open the printed local URL in a browser, confirm "LagoAgro" renders with the Tailwind styling actually visible (bold, larger text) — this is the one manual verification step in this task, since Vitest+jsdom doesn't compute real CSS layout/fonts. Stop the dev server after confirming.

- [ ] **Step 8: Update CLAUDE.md**

In "Estrutura de pastas do backend" section's intro sentence (just above the ` ``` ` code block), or as a new short paragraph right after that section, add one line: `Frontend em frontend/ na raiz do repo (React + Vite + TypeScript + Tailwind, ver docs/superpowers/specs/2026-08-01-frontend-scaffold-auth-design.md).`

In "Convenção de commits", add `frontend` to the valid scopes list:
```
Escopos válidos (batem com a estrutura de pastas): `properties`, `crops`,
`plantings`, `inputs`, `tasks`, `harvest`, `finance`, `notifications`,
`domain`, `auth`, `frontend`, `adr`.
```

- [ ] **Step 9: Commit**

```bash
git add frontend/ CLAUDE.md
git commit -m "feat(frontend): inicializar scaffold Vite + React + TypeScript + Tailwind"
```

---

### Task 2: Backend — `GET /api/auth/me/`

**Files:**
- Modify: `lagoagro/core/auth_views.py`
- Modify: `lagoagro/core/urls.py`
- Modify: `lagoagro/tests/test_auth.py`

**Interfaces:**
- Consumes: existing `IsAuthenticated`/`JWTAuthentication` global defaults (`REST_FRAMEWORK` in `core/settings.py`) — no new permission class needed.
- Produces: `GET /api/auth/me/` → `200 {"id": <int>, "username": <str>}` for a valid `Authorization: Bearer <access>` header; `401` with no/invalid token (already the global default behavior, verified by a test in this task, not reimplemented). Task 4 (frontend `AuthContext`) calls this endpoint after every successful refresh.

- [ ] **Step 1: Write the failing tests**

Append to `lagoagro/tests/test_auth.py` (reuses the existing `_criar_usuario()` helper already at the top of the file):

```python
def test_me_com_token_valido_retorna_dados_do_usuario():
    usuario = _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    access = login_response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get("/api/auth/me/")

    assert response.status_code == 200
    assert response.data == {"id": usuario.id, "username": "produtor1"}


def test_me_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/auth/me/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `lagoagro/`): `uv run pytest tests/test_auth.py -v`
Expected: FAIL — `404` on both new tests (route doesn't exist yet).

- [ ] **Step 3: Write the view**

Append to `lagoagro/core/auth_views.py`:
```python
class MeView(APIView):
    def get(self, request):
        return Response({"id": request.user.id, "username": request.user.username})
```
(No `permission_classes` override — this view inherits the project's global `IsAuthenticated` + `JWTAuthentication` defaults from `REST_FRAMEWORK` in `core/settings.py`, the same as every domain viewset. `LoginView`/`RefreshView`/`LogoutView` above it in this file explicitly set `permission_classes = [AllowAny]` because they must work *without* a token; `MeView` is the opposite case, so it takes the default.)

- [ ] **Step 4: Register the route**

In `lagoagro/core/urls.py`, update the import line:
```python
from core.auth_views import LoginView, LogoutView, MeView, RefreshView
```
Add the path in `urlpatterns`, next to the other auth paths:
```python
    path('api/auth/me/', MeView.as_view(), name='auth-me'),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_auth.py -v`
Expected: PASS (all tests in this file, including the 2 new ones)

- [ ] **Step 6: Run the full backend suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (157 — 155 existing + 2 new)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/core/auth_views.py lagoagro/core/urls.py lagoagro/tests/test_auth.py
git commit -m "feat(auth): adicionar endpoint GET /api/auth/me/"
```

---

### Task 3: `lib/api-client.ts`

**Files:**
- Create: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/lib/api-client.test.ts`

**Interfaces:**
- Consumes: nothing from this plan's earlier tasks (pure TS, no React). Consumes the backend contract from Task 2 and the project's existing auth endpoints only indirectly (calls `/auth/refresh/` by path — doesn't need Task 2's endpoint to be tested here, that's Task 4).
- Produces:
  - `setAccessToken(token: string | null): void`
  - `apiRequest<T>(path: string, options?: { method?: string; body?: unknown; headers?: HeadersInit }): Promise<T>`
  - `refreshAccessToken(): Promise<string>`
  - `class ApiError extends Error { status: number }`
  - `class AuthExpiredError extends Error {}`

  Task 4 imports `setAccessToken`, `refreshAccessToken`, `AuthExpiredError` directly. Every later frontend task (fatias 2-4) imports `apiRequest` for all backend calls.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/lib/api-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest, setAccessToken, ApiError, AuthExpiredError } from './api-client'

describe('apiRequest', () => {
  beforeEach(() => {
    setAccessToken(null)
    vi.restoreAllMocks()
  })

  it('injeta Authorization quando ha token em memoria', async () => {
    setAccessToken('token-123')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/plantios/')

    const [, options] = fetchMock.mock.calls[0]
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer token-123')
  })

  it('nao injeta Authorization quando nao ha token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/plantios/')

    const [, options] = fetchMock.mock.calls[0]
    expect((options.headers as Headers).has('Authorization')).toBe(false)
  })

  it('em 401, tenta refresh uma vez e repete a chamada original', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'novo-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest('/plantios/1/')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ id: 1 })
  })

  it('se o refresh tambem falhar, lanca AuthExpiredError e nao tenta de novo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/plantios/1/')).rejects.toBeInstanceOf(AuthExpiredError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lanca ApiError com o status certo em erro que nao seja 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ detail: 'Nao encontrado.' }), { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/plantios/999/')).rejects.toMatchObject({ status: 404 } as Partial<ApiError>)
  })

  it('retorna undefined em resposta 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest('/plantios/1/', { method: 'DELETE' })

    expect(result).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npm test`
Expected: FAIL — `Cannot find module './api-client'` (all 6 tests error on collection).

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/api-client.ts
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class AuthExpiredError extends Error {}

type ApiRequestOptions = {
  method?: string
  body?: unknown
  headers?: HeadersInit
}

async function rawFetch(path: string, options: ApiRequestOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

export async function refreshAccessToken(): Promise<string> {
  const response = await fetch('/api/auth/refresh/', { method: 'POST', credentials: 'include' })
  if (!response.ok) {
    throw new AuthExpiredError()
  }
  const data = (await response.json()) as { access: string }
  accessToken = data.access
  return data.access
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  isRetry = false,
): Promise<T> {
  const response = await rawFetch(path, options)

  if (response.status === 401 && !isRetry && path !== '/auth/refresh/') {
    await refreshAccessToken()
    return apiRequest<T>(path, options, true)
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}) as { detail?: string })
    throw new ApiError(response.status, detail.detail ?? 'Erro na requisicao')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (7 passed — 1 from Task 1's smoke test + 6 new)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api-client.ts frontend/src/lib/api-client.test.ts
git commit -m "feat(frontend): adicionar api-client com retry de refresh em 401"
```

---

### Task 4: `auth/AuthContext.tsx`

**Files:**
- Create: `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/auth/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `setAccessToken`, `refreshAccessToken`, `apiRequest` from `../lib/api-client` (Task 3).
- Produces:
  - `type Usuario = { id: number; username: string }`
  - `AuthProvider({ children }: { children: ReactNode })` — wraps the app.
  - `useAuth(): { usuario: Usuario | null; isLoading: boolean; login: (username: string, password: string) => Promise<void>; logout: () => Promise<void> }`

  Task 5's `LoginPage`, `ProtectedRoute`, and `AppShell` all consume `useAuth()`.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/auth/AuthContext.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { usuario, isLoading, login, logout } = useAuth()
  if (isLoading) return <div>carregando</div>
  return (
    <div>
      <div data-testid="usuario">{usuario ? usuario.username : 'deslogado'}</div>
      <button onClick={() => login('produtor1', 'senha123')}>entrar</button>
      <button onClick={() => logout()}>sair</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('bootstrap bem-sucedido popula o contexto via refresh + me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('produtor1'))
  })

  it('bootstrap com refresh invalido deixa o contexto deslogado', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })) // refresh falha
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))
  })

  it('login popula o contexto a partir da resposta de /auth/login/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // bootstrap: sem sessao
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'token-2', user: { id: 1, username: 'produtor1' } }), {
          status: 200,
        }),
      ) // login
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))

    screen.getByText('entrar').click()

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('produtor1'))
  })

  it('logout limpa o contexto mesmo se a chamada ao backend falhar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      .mockRejectedValueOnce(new Error('network down')) // logout falha
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('produtor1'))

    screen.getByText('sair').click()

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('deslogado'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npm test`
Expected: FAIL — `Cannot find module './AuthContext'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiRequest, refreshAccessToken, setAccessToken } from '../lib/api-client'

type Usuario = { id: number; username: string }

type AuthState = {
  usuario: Usuario | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      try {
        await refreshAccessToken()
        const me = await apiRequest<Usuario>('/auth/me/')
        setUsuario(me)
      } catch {
        // Cookie de refresh ausente/expirado, ou /auth/me/ falhou por
        // qualquer motivo apos um refresh bem-sucedido - em ambos os
        // casos o resultado e o mesmo: nao ha sessao valida, mostrar login.
        setAccessToken(null)
        setUsuario(null)
      } finally {
        setIsLoading(false)
      }
    }
    bootstrap()
  }, [])

  async function login(username: string, password: string) {
    const data = await apiRequest<{ access: string; user: Usuario }>('/auth/login/', {
      method: 'POST',
      body: { username, password },
    })
    setAccessToken(data.access)
    setUsuario(data.user)
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout/', { method: 'POST' })
    } catch {
      // logout e idempotente no backend - mesmo se a chamada falhar (rede,
      // token ja expirado), o usuario deve sair da UI de qualquer forma.
    } finally {
      setAccessToken(null)
      setUsuario(null)
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider')
  }
  return context
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (11 passed — 7 from Task 3 + 4 new)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth/AuthContext.tsx frontend/src/auth/AuthContext.test.tsx
git commit -m "feat(frontend): adicionar AuthContext com bootstrap, login e logout"
```

---

### Task 5: Routing shell — login, rota protegida, dashboard

**Files:**
- Create: `frontend/src/lib/query-client.ts`
- Create: `frontend/src/auth/LoginPage.tsx`
- Create: `frontend/src/auth/ProtectedRoute.tsx`
- Create: `frontend/src/layout/AppShell.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/routes.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx` (the Task 1 placeholder content is replaced here)
- Create: `frontend/src/routes.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `AuthProvider` from `../auth/AuthContext` (Task 4).
- Produces: the app's route tree, mounted in `main.tsx`. No later task in this plan consumes anything from here — this is the plan's final integration point.

- [ ] **Step 1: Install routing and query libraries**

```bash
npm install react-router-dom @tanstack/react-query
```

- [ ] **Step 2: Write the failing integration tests**

```tsx
// frontend/src/routes.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('roteamento', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('usuario deslogado tentando ver o dashboard e redirecionado pro login', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })) // bootstrap falha
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument())
  })

  it('login bem-sucedido leva ao dashboard com o nome do usuario', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // bootstrap: sem sessao
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'token-2', user: { id: 1, username: 'produtor1' } }), {
          status: 200,
        }),
      ) // login
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument())

    await user.type(screen.getByLabelText('Usuário'), 'produtor1')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())
  })

  it('logout volta pro login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'token-1' }), { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: 'produtor1' }), { status: 200 })) // me
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // logout
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Bem-vindo, produtor1/)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `frontend/`): `npm test`
Expected: FAIL — Task 1's `App.test.tsx` also now fails (it asserted the placeholder heading, which this task replaces) alongside the 3 new tests erroring on missing pieces. That's expected — Step 8 below deletes the now-obsolete `App.test.tsx`.

- [ ] **Step 4: Write `lib/query-client.ts`**

```ts
// frontend/src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()
```

- [ ] **Step 5: Write `auth/LoginPage.tsx`**

```tsx
// frontend/src/auth/LoginPage.tsx
import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await login(username, password)
    } catch {
      setError('Usuário ou senha inválidos.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <div>
          <label htmlFor="username">Usuário</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="block w-full border p-2"
          />
        </div>
        <div>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="block w-full border p-2"
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 p-2 text-white">
          Entrar
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Write `auth/ProtectedRoute.tsx`, `layout/AppShell.tsx`, `pages/DashboardPage.tsx`**

```tsx
// frontend/src/auth/ProtectedRoute.tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { usuario, isLoading } = useAuth()

  if (isLoading) return null
  if (!usuario) return <Navigate to="/login" replace />

  return <>{children}</>
}
```

```tsx
// frontend/src/layout/AppShell.tsx
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()

  return (
    <div>
      <header className="flex items-center justify-between border-b p-4">
        <span className="font-bold">LagoAgro</span>
        <button onClick={() => logout()} className="text-sm">
          Sair
        </button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

```tsx
// frontend/src/pages/DashboardPage.tsx
import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { usuario } = useAuth()

  return <p>Bem-vindo, {usuario?.username}</p>
}
```

- [ ] **Step 7: Write `routes.tsx`, wire `App.tsx` and `main.tsx`**

```tsx
// frontend/src/routes.tsx
import { createBrowserRouter } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'

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
])
```

```tsx
// frontend/src/App.tsx
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { queryClient } from './lib/query-client'
import { router } from './routes'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
```

`frontend/src/main.tsx` (generated by the Task 1 scaffold) needs no changes if it already just renders `<App />` inside `<StrictMode>` — confirm it does; if the scaffold's default differs, adjust it to match that shape without removing `<StrictMode>`.

- [ ] **Step 8: Delete the now-obsolete Task 1 smoke test**

`frontend/src/App.test.tsx` (from Task 1) asserted the placeholder heading that `App.tsx` no longer renders. Delete this file — `routes.test.tsx` (Step 2) now covers `App` end-to-end and supersedes it.

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (14 passed — 11 from Task 4 + 3 new; the deleted `App.test.tsx`'s 1 test is gone, netting 11 - 1 + 3 = 13 — recount after running and confirm the actual number matches what's in the test files, don't force it to match this estimate if the real count differs slightly)

- [ ] **Step 10: Run the production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 11: Manual verification of the dev proxy**

This is the one behavior in this plan that isn't practical to cover with a Vitest test (it requires two real running servers). In `frontend/vite.config.ts`, add a dev server proxy:
```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```
Then, with the Django dev server running (`uv run python manage.py runserver` from `lagoagro/`) and the Vite dev server running (`npm run dev` from `frontend/`), open the frontend's URL in a browser, and confirm the login page can actually submit against `POST /api/auth/login/` (create a user first via `uv run python manage.py createsuperuser` or the Django shell if none exists) without a CORS error in the browser console, and that a successful login lands on the dashboard showing "Bem-vindo, `<username>`". Stop both dev servers after confirming.

- [ ] **Step 12: Commit**

```bash
git add frontend/src frontend/vite.config.ts
git commit -m "feat(frontend): adicionar roteamento, login, dashboard e proxy de dev"
```

---

### Task 6: PWA scaffold — manifest, service worker, instalabilidade

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/icon-192.png`, `frontend/public/icon-512.png` (placeholder icons)
- Create: `frontend/src/sw.ts`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: nothing from earlier tasks in this plan (independent of the auth flow).
- Produces: an installable PWA. Fatia 3 (a future plan) extends `frontend/src/sw.ts` with `push`/`notificationclick` handlers and calls `POST /api/push-subscriptions/` — nothing in this task does that yet.

- [ ] **Step 1: Install `vite-plugin-pwa`**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Create placeholder icons**

Generate two solid-color PNG placeholders at `frontend/public/icon-192.png` (192×192) and `frontend/public/icon-512.png` (512×512) — any simple placeholder graphic is acceptable here (real branded icons are fatia 5's job per the design spec). If no image-generation tool is available in this environment, use a minimal script to produce a solid-color PNG, e.g. with Node and no extra dependency:
```bash
node -e "
const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, path) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const off = rowStart + 1 + x * 3;
      raw[off] = 22; raw[off + 1] = 101; raw[off + 2] = 52; // verde (#166534)
    }
  }
  const idat = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(path, png);
}

makePng(192, 'public/icon-192.png');
makePng(512, 'public/icon-512.png');
"
```
Run this from `frontend/`. Expected: two solid-green square PNGs (matching the manifest's `#166534` theme color) exist at those paths. Verify with `node -e "console.log(require('fs').statSync('public/icon-192.png').size, require('fs').statSync('public/icon-512.png').size)"` — both sizes should be greater than 0.

- [ ] **Step 3: Write `public/manifest.json`**

```json
{
  "name": "LagoAgro",
  "short_name": "LagoAgro",
  "description": "Gestão agrícola para pequeno produtor",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#166534",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Write `src/sw.ts`**

```ts
// frontend/src/sw.ts
import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// Handlers de 'push' e 'notificationclick' (ADR 005) sao adicionados numa
// fatia futura, quando a UI de tarefas existir pra mostrar o que a
// notificacao abre - ver docs/superpowers/specs/2026-08-01-frontend-scaffold-auth-design.md.
```

- [ ] **Step 5: Configure `vite-plugin-pwa` in `injectManifest` mode**

In `frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: false, // usamos public/manifest.json diretamente, nao o gerado pelo plugin
      injectRegister: 'auto',
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 6: Link the manifest in `index.html`**

In `frontend/index.html`, inside `<head>`, add (if not already present from the Vite template):
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#166534" />
```

- [ ] **Step 7: Verify the production build generates the service worker**

Run (from `frontend/`): `npm run build`
Expected: succeeds, and `frontend/dist/sw.js` exists (verify with `node -e "console.log(require('fs').existsSync('dist/sw.js'))"` — should print `true`).

- [ ] **Step 8: Run the full frontend test suite once more**

Run: `npm test`
Expected: same pass count as the end of Task 5 — this task added no new testable logic (PWA config isn't unit-testable through Vitest/jsdom; the build-output check in Step 7 is this task's verification).

- [ ] **Step 9: Manual verification of installability**

Run `npm run build && npm run preview` (the PWA plugin doesn't activate the real service worker in `npm run dev`, only in a built/served app). Open the printed preview URL in Chrome, open DevTools → Application → Manifest, confirm it loads `LagoAgro` with both icon sizes and no errors, and confirm DevTools → Application → Service Workers shows `sw.js` registered and activated. Stop the preview server after confirming.

- [ ] **Step 10: Commit**

```bash
git add frontend/public frontend/src/sw.ts frontend/vite.config.ts frontend/index.html
git commit -m "feat(frontend): adicionar scaffold PWA (manifest, service worker, instalabilidade)"
```

---

## Post-plan note

This plan delivers a working, tested auth flow and an installable (but push-inert) PWA shell. **Nothing here builds any domain screen** (propriedades, plantios, insumos, tarefas, colheita, financeiro) — those are fatias 2-4, each its own brainstorm→spec→plan→SDD cycle, building on `lib/api-client.ts` and `lib/query-client.ts` from this plan. Fatia 3 is where `src/sw.ts` gains real `push`/`notificationclick` handlers and where the frontend first calls `POST /api/push-subscriptions/` (Task #7's registration API) — do not add push logic to `sw.ts` before that fatia's own design pass, even though this plan's Task 6 leaves an obvious-looking gap there; the tasks/dashboard UI that push notifications need to open doesn't exist yet.
