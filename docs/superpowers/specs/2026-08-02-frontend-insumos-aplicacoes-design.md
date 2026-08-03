# Design — Frontend: insumos + aplicações (Task #8, fatia 3a/5)

## Contexto

Fatias 1 (scaffold + auth) e 2 (cadastro — propriedades/talhões, culturas,
plantios) estão mergeadas em `master`. `lib/api-client.ts`,
`lib/query-client.ts`, `ProtectedRoute`, `AppShell` com nav, e os padrões de
formulário (react-hook-form + zod) e página (useQuery + useMutation, sem
hooks customizados) já estão estabelecidos.

A fatia 3 original ("insumos + aplicações + tarefas + dashboard (RF12) +
fluxo de push") foi decomposta em 3 sub-fatias por bundlar três peças
independentes:

1. **Insumos + aplicações (este documento)**
2. Tarefas + dashboard (RF12)
3. Fluxo de push (permissão, subscribe, service worker, endpoint de VAPID
   public key)

Este documento cobre só a primeira.

## Contrato real do backend (confirmado lendo `lagoagro/inputs/`)

- `GET/POST/PATCH/DELETE /api/insumos/` — CRUD completo
  (`InsumoViewSet(UsuarioScopedQuerySetMixin, ModelViewSet)`,
  `usuario_lookup="usuario"`). `InsumoSerializer`: `{id, nome, tipo,
  carencia_dias}`. `tipo` é `"veneno" | "adubo"`. `carencia_dias` é
  `PositiveIntegerField` (chega como número).
- `GET/POST/DELETE /api/aplicacoes-insumo/` — **sem PATCH/PUT** (viewset é
  `ModelViewSet` mas o serializer/uso pretendido é create+list+delete; ver
  decisão abaixo). `AplicacaoInsumoSerializer`: `{id, plantio, insumo,
  data, quantidade}`. `plantio` e `insumo` são IDs (FK), já restritos por
  querysets escopados no `__init__` do serializer (só plantios/insumos do
  usuário autenticado aparecem como opção válida). `quantidade` é
  `DecimalField` — chega como **string** no JSON (ex: `"12.50"`), mesmo
  padrão de `Talhao.area` na fatia 2.
- `AplicacaoInsumo.plantio` e `.insumo` são `on_delete=PROTECT` (trilha de
  auditoria, ADR 007/008) — excluir um Plantio ou Insumo referenciado por
  alguma aplicação é bloqueado pelo banco. Um exception handler global
  (`core/exceptions.py`) converte esse `ProtectedError` em `409 Conflict`
  com `{"detail": "Não é possível excluir: existem registros vinculados a
  este item."}`.
- `AplicacaoInsumo.created_by`/`.created_at` existem no model (trilha de
  auditoria) mas **não estão nos `fields` do serializer** — não aparecem
  na API, não precisam de UI.

Roteados via `DefaultRouter` em `core/urls.py`, mesmo padrão dos endpoints
da fatia 2.

## Decisões de abordagem

**Sem endpoint PATCH/PUT para AplicacaoInsumo → sem "Editar" na UI.** O
viewset é tecnicamente um `ModelViewSet` (herda update/partial_update do
DRF), mas a intenção do domínio é que uma aplicação registrada seja
imutável — é evidência de auditoria (created_by/created_at, FKs PROTECT).
A UI não expõe ação de editar; só criar e excluir. Se um usuário errar um
registro, a correção é excluir e recriar.

**Exclusão de Insumo com pré-checagem client-side de uso.** Antes de abrir
o `ConfirmDialog` de exclusão de um Insumo, busca (via cache do TanStack
Query, reaproveitando `useQuery(['aplicacoes'])` se já carregada nesta
sessão) quantas `AplicacaoInsumo` referenciam aquele insumo e mostra a
contagem na mensagem de confirmação — mesmo padrão de cascata da fatia 2
(`"Isso é usado em N aplicação(ões) registrada(s) e não poderá ser
excluído."`, omitida se N = 0). O 409 do backend continua como rede de
segurança se a contagem ficar desatualizada entre o check e o clique (ex:
segunda aba abriu uma aplicação nova nesse meio-tempo); nesse caso a
mensagem de erro da mutação (ver seção "Erros e loading") exibe o
`detail` do backend.

**Tratamento de erro de mutação, agora implementado (dívida da fatia 2).**
`InsumoForm` e `AplicacaoInsumoForm` mapeiam erro 400 do backend
(`{"campo": ["mensagem"]}`) para `setError` do react-hook-form no campo
correspondente, e mostram uma mensagem geral do formulário quando não há
chave de campo (erro de rede, 409, 500). `PropriedadeForm`/`TalhaoForm`/
`PlantioForm` da fatia 2 **não são retrofitados** nesta sub-fatia — ficam
como estão, por decisão explícita do usuário (2026-08-02), para não
expandir escopo tocando código já mergeado e testado. Retrofit deles é um
item separado, a decidir à parte.

**RF06/RF07 fora de escopo.** Nenhum endpoint expõe
`domain/cycle_calc.py` (dias restantes de ciclo) nem
`domain/safety_calc.py` (data segura de colheita) — são funções Python
puras, sem view/serializer. Esta sub-fatia não cria esse endpoint nem
exibe esses valores calculados. Candidata natural para uma fatia futura:
3b (dashboard RF12), onde esse tipo de cálculo teria o lugar mais natural
junto das tarefas.

**Sem filtro por plantio em `/aplicacoes`.** Lista simples, ordenada por
data mais recente — mesmo padrão de `PlantiosPage`. Filtro pode ser
adicionado depois se o volume de dados justificar; não foi validado como
dor real com o usuário final ainda.

**Mesma stack e convenções da fatia 2**: react-hook-form + zod, TanStack
Query (`useQuery`/`useMutation`, sem hooks customizados por entidade, sem
optimistic update), Vitest + React Testing Library, `npx tsc -b`
obrigatório em toda revisão de task.

## Estrutura de arquivos

```
frontend/src/
├── api/
│   ├── insumos.ts            — tipo Insumo + listarInsumos/criarInsumo/atualizarInsumo/excluirInsumo
│   └── aplicacoes.ts         — tipo AplicacaoInsumo + listarAplicacoes/criarAplicacao/excluirAplicacao (sem atualizar)
├── components/
│   ├── InsumoForm.tsx        — react-hook-form + zod, criar/editar, tratamento de erro 400
│   └── AplicacaoInsumoForm.tsx — idem, inclui select de plantio e de insumo, só criar
├── pages/
│   ├── InsumosPage.tsx       — lista + criar/editar/excluir, pré-checagem de uso antes de excluir
│   └── AplicacoesPage.tsx    — lista + criar/excluir (sem editar)
├── layout/
│   └── AppShell.tsx          — MODIFICADO: + links de nav pra /insumos, /aplicacoes
└── routes.tsx                — MODIFICADO: + rotas protegidas /insumos, /aplicacoes
```

`api/insumos.ts` e `api/aplicacoes.ts` seguem o mesmo padrão fino sobre
`apiRequest<T>()` das fatias anteriores — tipo TypeScript refletindo o
serializer real (`quantidade: string` em `AplicacaoInsumo`, mesmo padrão
de `area: string` em `Talhao`), sem lógica além de montar path/método/
corpo. `api/aplicacoes.ts` não exporta `atualizarAplicacao` (não existe
endpoint PATCH/PUT a chamar).

## Navegação

Duas rotas novas (`/insumos`, `/aplicacoes`), protegidas por
`ProtectedRoute`, linkadas no nav do `AppShell` junto às rotas da fatia 2.

## Insumos

`InsumosPage`: `useQuery(['insumos'], listarInsumos)`, lista com
nome/tipo (rótulo em português: "Veneno"/"Adubo")/carência em dias, ações
inline de editar/excluir. Botão "+ Insumo" no topo abre `InsumoForm`.

Exclusão: busca `useQuery(['aplicacoes'], listarAplicacoes)` (cache
reaproveitado se `/aplicacoes` já foi visitada nesta sessão), filtra
client-side por `aplicacao.insumo === insumo.id`, mostra a contagem no
`ConfirmDialog`. Erro 409 do backend (se a pré-checagem ficou
desatualizada) aparece como mensagem geral, sem fechar o diálogo
automaticamente — usuário pode cancelar manualmente.

`InsumoForm` (react-hook-form + zod): campos `nome` (texto obrigatório),
`tipo` (select "Veneno"/"Adubo"), `carencia_dias` (número inteiro ≥ 0,
mesmo padrão `.string().refine(...)` de campos numéricos da fatia 2 — não
usa `.coerce` pra evitar a divergência de tipo input/output já documentada
na fatia 2).

## Aplicações

`AplicacoesPage`: `useQuery(['aplicacoes'], listarAplicacoes)` para a
lista, mais `useQuery(['plantios'])`, `useQuery(['talhoes'])`,
`useQuery(['culturas'])` e `useQuery(['insumos'])` (todas reaproveitando
cache do TanStack Query se o usuário já visitou as páginas correspondentes
nesta sessão) só para:

- popular o `<select>` de plantio em `AplicacaoInsumoForm` com o label
  reconstruído `"{cultura.nome} — {talhao.nome} — {data_plantio}"`
  (mesma lógica de `nomeTalhao`/`nomeCultura` de `PlantiosPage.tsx`, já
  que `PlantioSerializer` não retorna `talhao`/`cultura` aninhados);
- popular o `<select>` de insumo com `insumo.nome`;
- exibir esses mesmos labels reconstruídos na lista de aplicações (em vez
  de IDs crus).

`AplicacaoInsumoForm` (react-hook-form + zod): campos `plantio` (select),
`insumo` (select), `data` (input `type="date"`), `quantidade` (texto,
`.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, ...)`,
mesmo padrão de `Talhao.area`). Só modo criar — nenhum modo editar, então
o formulário não recebe prop de entidade existente nem pré-popula nada.

Lista mostra label do plantio, nome do insumo, `data` formatada
(`dd/mm/aaaa`, mesma técnica de `new Date(\`${data}T00:00:00\`)` da fatia
2 pra evitar shift de fuso), `quantidade`, com ação inline de excluir
apenas (sem editar).

Exclusão de uma aplicação: `ConfirmDialog` simples ("Tem certeza que
deseja excluir esta aplicação?"), sem pré-checagem (nada referencia
`AplicacaoInsumo` via FK — ela é sempre a ponta da cadeia, exclusão nunca
é bloqueada pelo backend).

## Erros e loading

- **Loading:** texto simples "Carregando..." por lista — mesmo padrão da
  fatia 2.
- **Erro de fetch:** mensagem inline na página com botão "Tentar
  novamente" chamando `refetch()` — mesmo padrão da fatia 2.
- **Erro de mutação (implementado nesta fatia, ver decisão acima):** corpo
  de erro DRF (`ApiError.body`) mapeado para `setError` do campo
  correspondente quando as chaves batem; mensagem geral do formulário
  (incluindo o `detail` de um 409) quando não há chave de campo
  correspondente.
- **`AuthExpiredError`:** já tratado globalmente, nenhuma página desta
  fatia precisa de tratamento próprio.

## Testes

Mesmo padrão das fatias 1–2 (Vitest + React Testing Library + `user-event`,
mock de `apiRequest` via `vi.mock('../lib/api-client')`):

- **`api/*.ts`:** um teste por função confirmando path/método/corpo;
  `api/aplicacoes.ts` sem teste de `atualizarAplicacao` (não existe).
- **`InsumosPage`:** lista carrega e renderiza; criar insumo via
  formulário faz o novo item aparecer na lista; excluir insumo sem
  aplicações vinculadas não mostra aviso de uso; excluir insumo com N
  aplicações mostra a contagem certa no diálogo; erro 409 simulado do
  backend aparece como mensagem no diálogo sem fechá-lo.
- **`AplicacoesPage`:** selects de plantio/insumo são populados com os
  labels reconstruídos certos; criar aplicação faz o novo item aparecer
  na lista com plantio/insumo/data/quantidade formatados corretamente;
  nenhum botão "Editar" está presente na página (teste negativo); excluir
  aplicação remove o item da lista.
- **`InsumoForm`/`AplicacaoInsumoForm`:** erro 400 simulado com chave de
  campo reflete no campo certo (`setError`); erro sem chave de campo
  reconhecida mostra mensagem geral do formulário.

## Fora de escopo (fatias seguintes)

- RF06/RF07 (dias restantes de ciclo, data segura de colheita) — sem
  endpoint hoje; candidata a 3b junto do dashboard RF12.
- Retrofit de tratamento de erro de mutação em `PropriedadeForm`/
  `TalhaoForm`/`PlantioForm` (fatia 2) — decisão separada, não implícita
  nesta spec.
- Filtro por plantio em `/aplicacoes` — sem sinal de necessidade real
  ainda.
- Tarefas, dashboard (RF12) — fatia 3b.
- Fluxo de push (permissão, subscribe, service worker, endpoint de VAPID
  public key) — fatia 3c.
- Colheita, financeiro — fatia 4.
- Ícones reais, prompt de instalação, offline shell — fatia 5.
