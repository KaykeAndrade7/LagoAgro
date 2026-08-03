# Design — Frontend: fluxo de push (Task #8, fatia 3c/5)

## Contexto

Fatias 1 (scaffold+auth), 2 (cadastro) e 3a/3b (insumos+aplicações,
tarefas+dashboard) estão mergeadas. RF11 (notificar o usuário no dia da
tarefa) já está implementado no backend desde o Task #7:
`notifications.PushSubscription` (model), `POST/GET/DELETE
/api/push-subscriptions/`, `enviar_notificacoes_do_dia()` (serviço),
`enviar_notificacoes_do_dia` (management command) e
`DispararNotificacoesView` (endpoint protegido por chave secreta pro cron
externo). O que falta é inteiramente do lado do navegador: pedir
permissão, assinar (`pushManager.subscribe`), e o service worker saber
mostrar/abrir a notificação.

Esta é a terceira e última sub-fatia da fatia 3/5 original (a primeira,
"insumos + aplicações + tarefas + dashboard RF12 + fluxo de push", foi
decomposta em 3a/3b/3c por bundlar peças independentes).

## Contrato real do backend (confirmado lendo `lagoagro/notifications/`)

- `PushSubscription`: `usuario` (FK), `endpoint` (URL, único), `p256dh`,
  `auth`, `criado_em`. `PushSubscriptionViewSet` é
  `list/create/retrieve/destroy` apenas (sem update/partial_update, por
  design — reenviar o mesmo `endpoint` faz `update_or_create` na view, não
  edição via PATCH/PUT).
- `settings.VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_CLAIM_EMAIL` já
  existem (env vars, default vazio em dev). Chaves reais de produção
  continuam adiadas pro Task #9 (Deploy) — nenhuma mudança nisso aqui.
- **Nenhum endpoint expõe `VAPID_PUBLIC_KEY` pro frontend hoje** — é o que
  esta fatia adiciona.
- Payload que o backend manda no push (`services.py`):
  `{"title": "LagoAgro", "body": "Tarefa de hoje: {descricao}"}` — sem
  campo de URL. Não alterado nesta fatia (decisão do usuário).

## Decisões de abordagem

**Endpoint novo, público (`AllowAny`), sem alterar nada existente.**
`GET /api/notificacoes/chave-publica/` retorna `{"public_key":
settings.VAPID_PUBLIC_KEY}`. Decisão do usuário (2026-08-03): a chave
pública não é segredo por definição (é a metade pública do par VAPID,
feita pra ser distribuída) — não precisa de JWT. Mesmo padrão de rota de
`DispararNotificacoesView` (`core/urls.py`, prefixo `api/notificacoes/`).
Se `VAPID_PUBLIC_KEY` estiver vazia (padrão em dev sem chaves reais), a
resposta é `{"public_key": ""}` — não é erro, o frontend trata isso como
"notificações indisponíveis neste ambiente".

**Gatilho da UI: botão no `AppShell`, ao lado de "Sair".** Sempre visível
em qualquer página, mesmo padrão do logout — decisão do usuário
(2026-08-03), preferido a um banner só no Dashboard.

**Só ativar, sem desativar (unsubscribe) nesta fatia.** Decisão do
usuário (2026-08-03): o botão assina e vira um estado "ativado" (texto
estático, sem mais ação). Desativar fica pra quando for necessidade real
— o backend já tem `DestroyModelMixin` pronto pra isso.

**`notificationclick` sempre abre `"/"` — sem mudar o payload do
backend.** Decisão do usuário (2026-08-03): não altera `services.py`
(já mergeado, testado, fora do escopo desta sub-fatia). O clique foca uma
aba já aberta do app ou abre `"/"` (o painel RF12, onde a tarefa do dia já
aparece agrupada por talhão).

**Degradação graciosa quando o navegador não suporta Push API.** Nem
todo navegador tem `ServiceWorkerRegistration.pushManager` (ex.: alguns
navegadores mais antigos). O botão "Ativar notificações" **não aparece**
no `AppShell` se `'serviceWorker' in navigator && 'PushManager' in window
&& 'Notification' in window` for falso — evita expor uma ação que sempre
falharia.

**`sw.ts` sem teste unitário — mesma convenção já em vigor desde a fatia
1.** O arquivo não tem nenhum teste hoje (é `ServiceWorkerGlobalScope`,
não roda em jsdom sem mocks extensos de baixo valor). Verificado só por
`tsc -b`. Decisão consciente, não descuido — registrada aqui pra não ser
questionada como lacuna de cobertura numa revisão futura.

**Mesma stack e convenções das fatias anteriores**: TanStack Query onde
fizer sentido (a chave pública é buscada sob demanda no clique, não
precisa de `useQuery` — é uma chamada única, não um dado que muda), sem
hooks customizados por entidade, Vitest + React Testing Library,
`npx tsc -b` obrigatório em toda revisão de task.

## Estrutura de arquivos

```
lagoagro/
├── notifications/
│   ├── views.py           — MODIFICADO: + VapidPublicKeyView (AllowAny, GET)
│   └── (sem mudança de models/serializers — resposta é um dict simples)
└── core/
    └── urls.py             — MODIFICADO: + rota api/notificacoes/chave-publica/

frontend/src/
├── api/
│   └── push.ts             — obterChavePublicaVapid() + registrarPushSubscription(input)
├── lib/
│   └── push.ts             — suportaPush(), ativarNotificacoes() (orquestra permissão+subscribe+registro), urlB64ToUint8Array
├── layout/
│   └── AppShell.tsx         — MODIFICADO: + botão "Ativar notificações"
└── sw.ts                    — MODIFICADO: + listeners de 'push' e 'notificationclick'
```

## Backend: `VapidPublicKeyView`

```python
class VapidPublicKeyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"public_key": settings.VAPID_PUBLIC_KEY})
```

Roteado em `core/urls.py` como
`path('api/notificacoes/chave-publica/', VapidPublicKeyView.as_view(), name='notificacoes-chave-publica')`,
ao lado de `notificacoes-disparar`. Testes em
`lagoagro/tests/test_notifications_views.py` (mesmo arquivo dos testes de
`PushSubscriptionViewSet`): retorna a chave configurada via
`settings.VAPID_PUBLIC_KEY` (override em teste), retorna string vazia
quando não configurada, não exige autenticação.

## Frontend: `api/push.ts`

```ts
export function obterChavePublicaVapid(): Promise<{ public_key: string }> {
  return apiRequest<{ public_key: string }>('/notificacoes/chave-publica/')
}

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string }

export function registrarPushSubscription(input: PushSubscriptionInput): Promise<{ id: number }> {
  return apiRequest<{ id: number }>('/push-subscriptions/', { method: 'POST', body: input })
}
```

## Frontend: `lib/push.ts`

Orquestra o fluxo inteiro, retornando um resultado tipado em vez de
lançar (a UI decide a mensagem por cima):

```ts
export type ResultadoAtivacao = 'ativado' | 'negado' | 'indisponivel'

export function suportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
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

`urlB64ToUint8Array` é o helper padrão (VAPID key chega em base64url, a
Push API exige `Uint8Array` em `applicationServerKey`).

## Frontend: `AppShell.tsx`

Novo estado local (`'idle' | 'carregando' | 'ativado' | 'negado' |
'indisponivel' | 'erro'`). Renderiza o botão "Ativar notificações" só se
`suportaPush()` for verdadeiro; ao clicar, chama `ativarNotificacoes()` e
atualiza o estado:
- `'ativado'`: substitui o botão por texto estático "Notificações
  ativadas".
- `'negado'`: mensagem inline "Permissão negada — ative nas
  configurações do navegador.", botão continua clicável (o navegador não
  reprompta, só retorna `'denied'` de novo — inofensivo permitir nova
  tentativa).
- `'indisponivel'`: mensagem inline "Notificações indisponíveis neste
  ambiente." (chave VAPID não configurada).
- erro de rede ao registrar no backend: mensagem inline genérica de erro.

## Frontend: `sw.ts`

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

## Testes

- **Backend**: `VapidPublicKeyView` — chave configurada, chave vazia, sem
  autenticação exigida.
- **`api/push.ts`**: um teste por função (path/método/corpo), mesmo
  padrão de `api/tarefas.ts`.
- **`lib/push.ts`**: `suportaPush()` com/sem as APIs presentes;
  `ativarNotificacoes()` cobrindo os 3 resultados (`ativado`, `negado`,
  `indisponivel` por falta de suporte, `indisponivel` por chave vazia) —
  `Notification`, `navigator.serviceWorker`, `PushManager` mockados via
  `vi.stubGlobal`/`Object.defineProperty`.
- **`AppShell.test.tsx` (novo arquivo)**: botão não aparece quando
  `suportaPush()` é falso; clique bem-sucedido troca pra texto "ativado";
  permissão negada mostra a mensagem certa; chave vazia mostra "
  indisponível".
- **`sw.ts`**: sem teste unitário (decisão documentada acima),
  verificado só por `tsc -b`.

## Fora de escopo (fatias seguintes)

- Desativar notificações (unsubscribe) — fica pra quando virar
  necessidade real.
- URL específica no payload de push (ex.: abrir `/tarefas` direto) — exige
  tocar `services.py`, fora de escopo aqui.
- Chaves VAPID reais de produção, cron externo, secret de produção —
  Task #9 (Deploy).
- Colheita, financeiro — fatia 4.
- Ícones reais, prompt de instalação — fatia 5 (offline shell **não**
  é necessário — RNF02 define o app como sempre-online).
