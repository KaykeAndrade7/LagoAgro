# Design — Frontend: scaffold + autenticação (Task #8, fatia 1/5)

## Contexto

O backend está completo (Tasks #1–#7): Django+DRF com JWT (access curto +
refresh em cookie HttpOnly, ADR 003), 11 rotas de domínio multi-tenant
(Task #6) e a API de registro de push notification (Task #7, ainda inerte —
sem chaves VAPID/cron reais até o Task #9). ADR 004 já fixou a stack do
frontend (React + Vite + TailwindCSS, PWA) e ADR 005 já decidiu Web Push via
PWA como canal de notificação.

"Frontend PWA completo" é grande demais para um ciclo só de
brainstorm→spec→plano, então o trabalho foi dividido em 5 fatias
(decisão registrada na conversa, não em ADR — é sequenciamento de tarefas,
não arquitetura):

1. **Scaffold + auth shell** (este documento)
2. Cadastro (propriedades/talhões, culturas, plantios)
3. Insumos + aplicações + tarefas + dashboard (RF12) + fluxo de push
4. Colheita + financeiro
5. Polimento PWA (ícones, prompt de instalação, offline shell)

Este documento cobre só a fatia 1: o esqueleto técnico que toda fatia
seguinte depende — build tooling, autenticação, roteamento protegido, e o
scaffold do PWA (sem lógica de push ainda). Nenhuma tela de domínio
(propriedade, plantio, etc.) é construída aqui.

## Decisões de abordagem

**TanStack Query + wrapper `fetch` tipado**, não Redux Toolkit/RTK Query nem
`fetch`/`useEffect` cru por página. RTK é poder demais para um app que é,
na prática, CRUD sobre uma API REST sem estado client-side complexo. `fetch`
cru duplicaria loading/error/refetch-after-mutation em ~8 páginas de
domínio que vêm nas fatias 2–4 — TanStack Query é uma dependência pequena e
focada que remove essa duplicação, mesmo raciocínio já usado no backend pra
justificar `pywebpush` como dependência pequena que vale a pena.

**TypeScript**, não JavaScript puro — decisão do usuário (tipagem pega erro
de contrato com a API em build time).

**`vite-plugin-pwa` em modo `injectManifest`**, não `generateSW`. O Web
Push (ADR 005) precisa de um handler de evento `push` escrito à mão no
service worker — o service worker autogerado do `generateSW` não permite
isso. `injectManifest` deixa o precache automático (Workbox) mas o arquivo
do service worker é nosso, com espaço pra lógica de push futura (fatia 3).

**Proxy do Vite em dev, não `django-cors-headers` agora.** O servidor de
dev do Vite faz proxy de `/api/*` pra `http://localhost:8000` — o browser
vê same-origin, sem precisar de CORS em dev. CORS de produção
(`django-cors-headers`, restrito à origem real do Vercel) continua no
Task #9, onde já estava planejado (a origem de produção só existe depois do
deploy).

## Fluxo de autenticação

Contrato real do backend (`lagoagro/core/auth_views.py`, não muda aqui):

- `POST /api/auth/login/` `{username, password}` → `{access, user: {id, username}}` + cookie `refresh` (HttpOnly, setado pelo backend).
- `POST /api/auth/refresh/` (sem body — o cookie `refresh` é lido automaticamente pelo backend) → `{access}` + cookie `refresh` renovado.
- `POST /api/auth/logout/` → invalida o refresh token (blacklist) e apaga o cookie.

**Access token só em memória** (estado de um `AuthContext` React), nunca em
`localStorage`/`sessionStorage` — mitigação de XSS (se algum script
injetado rodar, não há token lendo do storage). O cookie `refresh` já é
HttpOnly por decisão do backend (ADR 003), então JS nunca precisa
manipulá-lo diretamente — o browser o envia sozinho em toda requisição
para o backend (mesma origem via proxy do Vite em dev; mesma decisão em
produção quando o Task #9 configurar isso).

**Correção em relação ao contrato real do backend:** `POST
/api/auth/refresh/` retorna só `{access}` — sem dados do usuário
(`core/auth_views.py::RefreshView`, confirmado ao virar isto em plano). Só
`POST /api/auth/login/` retorna `{access, user}`. Sem isso, um reload de
página (fluxo de bootstrap via refresh) teria um `access` válido mas
nenhum `username` pra mostrar. Este documento por isso inclui um endpoint
novo, pequeno: **`GET /api/auth/me/`** (`core/auth_views.py`, protegido
pelo `IsAuthenticated`/`JWTAuthentication` que já são o default global do
projeto — sem `permission_classes` especial, ao contrário de
Login/Refresh/Logout que são `AllowAny`) retornando
`{"id": ..., "username": ...}` do usuário autenticado. Decisão: resolver
isso no backend (endpoint novo, ~10 linhas, mesmo padrão de todo o resto da
API) em vez de cachear o usuário no `localStorage` no frontend — evita
dado potencialmente desatualizado e mantém a regra "nada sensível nem
não-sensível de sessão persiste no browser" simples de enunciar.

**Bootstrap ao carregar o app:** antes de renderizar qualquer rota
protegida, `AuthContext` tenta uma vez `POST /api/auth/refresh/`; se
suceder, encadeia `GET /api/auth/me/` com o novo `access` pra obter
`{id, username}` e popular o contexto — sessão sobrevive a F5 sem precisar
digitar senha de novo. Se o refresh falhar (cookie ausente/expirado), o
app mostra a tela de login normalmente.

**Refresh-on-401:** o `api-client.ts` intercepta qualquer resposta 401 de
uma chamada autenticada, tenta `POST /api/auth/refresh/` **uma vez**, e se
suceder repete a chamada original com o novo `access`. Se o refresh também
falhar, limpa o `AuthContext` e redireciona para `/login`. Nunca mais que
uma tentativa de refresh por chamada (evita loop infinito se o refresh
também retornar 401).

**Logout:** chama `POST /api/auth/logout/`, limpa o `AuthContext`
independentemente da resposta (logout é idempotente no backend — mesmo que
a chamada falhe por rede, o usuário some da UI).

## PWA (scaffold, sem lógica de push)

- `vite-plugin-pwa` em modo `injectManifest`, `manifest.json` com nome,
  ícones (placeholder nesta fatia — ícones reais na fatia 5), `theme_color`,
  `display: "standalone"`.
- `src/sw.ts` — arquivo próprio do service worker, registrado pelo plugin.
  Nesta fatia só faz precache via `workbox-precaching` (o mínimo pra passar
  no critério de instalabilidade do Chrome/Android). Nenhum handler de
  `push`/`notificationclick` ainda — isso é fatia 3, quando a UI de tarefas
  existir pra mostrar o que a notificação abre.
- App instalável (`Adicionar à tela inicial`) já funciona ao final desta
  fatia, mesmo sem push real — RNF06 (mobile-first) começa a ser validável
  cedo.

## Estrutura de arquivos

```
frontend/
├── src/
│   ├── main.tsx              — entrypoint, monta QueryClientProvider + AuthProvider + RouterProvider
│   ├── App.tsx                — layout raiz
│   ├── routes.tsx             — definição de rotas (react-router-dom)
│   ├── lib/
│   │   ├── api-client.ts      — fetch tipado, injeta Authorization, refresh-on-401
│   │   └── query-client.ts    — instância do TanStack QueryClient
│   ├── auth/
│   │   ├── AuthContext.tsx    — access token em memória, bootstrap via refresh, login/logout
│   │   ├── LoginPage.tsx
│   │   └── ProtectedRoute.tsx — redireciona pra /login se não autenticado
│   ├── layout/
│   │   └── AppShell.tsx       — header/nav + botão de logout, envolve páginas autenticadas
│   ├── pages/
│   │   └── DashboardPage.tsx  — placeholder ("Bem-vindo, {username}"), landing pós-login
│   └── sw.ts                  — service worker (injectManifest)
├── public/
│   └── manifest.json + ícones placeholder
├── index.html
├── vite.config.ts             — plugin React, plugin PWA, proxy de /api
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

Um arquivo de teste por unidade de lógica real (`api-client.test.ts`,
`AuthContext.test.tsx`) — não é necessário testar componentes puramente de
apresentação (`AppShell`, `DashboardPage`) nesta fatia, já que não têm
lógica própria além de renderizar props/contexto.

## Testes

Vitest + React Testing Library (par nativo do Vite, mesma filosofia de TDD
já usada no backend). Cobertura mínima desta fatia:

- `api-client.ts`: injeta `Authorization: Bearer <token>` quando há token
  em memória; em 401, tenta refresh uma vez e repete a chamada original; se
  o refresh falhar, propaga o erro (quem escuta isso é o `AuthContext`, não
  o client) e não tenta de novo.
- `AuthContext.tsx`: bootstrap bem-sucedido popula o contexto; bootstrap
  falho deixa o contexto deslogado; `login()` popula o contexto a partir da
  resposta de `/api/auth/login/`; `logout()` limpa o contexto mesmo se a
  chamada ao backend falhar.
- `ProtectedRoute.tsx`: redireciona pra `/login` quando deslogado, renderiza
  os filhos quando autenticado.

## Fora de escopo (fatias seguintes)

- Qualquer tela de domínio (propriedade, talhão, plantio, insumo, tarefa,
  colheita, financeiro) — fatias 2–4.
- Handler de push (`push`/`notificationclick` no service worker) e a
  chamada a `POST /api/push-subscriptions/` — fatia 3.
- Ícones reais, prompt de instalação customizado, ajuste fino de cache
  offline — fatia 5.
- `django-cors-headers` e CORS de produção — Task #9 (Deploy).
