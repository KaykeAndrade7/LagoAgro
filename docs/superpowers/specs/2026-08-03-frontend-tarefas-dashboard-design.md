# Design — Frontend: tarefas + dashboard RF12 (Task #8, fatia 3b/5)

## Contexto

Fatias 1 (scaffold + auth), 2 (cadastro) e 3a (insumos + aplicações) estão
mergeadas em `master`. `lib/api-client.ts`, `lib/query-client.ts`,
`ProtectedRoute`, `AppShell` com nav, os padrões de formulário
(react-hook-form + zod) e de página (`useQuery`/`useMutation`, sem hooks
customizados por entidade), e o padrão de mapeamento de erro de mutação
(introduzido na 3a em `InsumoForm`/`AplicacaoInsumoForm`) já estão
estabelecidos.

A fatia 3 original foi decomposta em 3 sub-fatias:

1. Insumos + aplicações — mergeada 2026-08-02.
2. **Tarefas + dashboard RF12 (este documento)**
3. Fluxo de push (permissão, subscribe, service worker, endpoint de VAPID
   public key)

Este documento cobre só a segunda.

## Contrato real do backend (confirmado lendo `lagoagro/tasks/`)

- `GET/POST/PATCH/DELETE /api/tarefas/` — CRUD completo
  (`TarefaViewSet(UsuarioScopedQuerySetMixin, ModelViewSet)`,
  `usuario_lookup="plantio__talhao__propriedade__usuario"`).
  `TarefaSerializer`: `{id, plantio, descricao, data, concluida}`. `plantio`
  é FK (ID), já restrito a plantios do usuário autenticado via queryset
  escopado no `__init__` do serializer (mesmo padrão de
  `AplicacaoInsumoSerializer`). `descricao` é `CharField(max_length=255)`,
  `data` é `DateField`, `concluida` é `BooleanField`.
- `Tarefa.notificado_em` existe no model (usado pelo job de push, RF11) mas
  **não está nos `fields` do serializer** — não aparece na API, não precisa
  de UI.
- PATCH parcial já funciona (é o comportamento padrão de `ModelViewSet`) e
  já é escopado por usuário — nenhuma mudança de backend necessária para o
  checkbox de conclusão (`PATCH {"concluida": true}`).

Roteado via `DefaultRouter` em `core/urls.py`, mesmo padrão dos endpoints
das fatias anteriores.

## Decisões de abordagem

**`TarefaForm` com edição habilitada.** Diferente de `AplicacaoInsumoForm`
(sem edição, por ser evidência de auditoria com FKs `PROTECT`), `Tarefa`
não tem essa restrição — é só um lembrete que o usuário pode querer
corrigir ou reagendar. `TarefaForm` segue o padrão de criar+editar de
`PlantioForm`.

**Marcar conclusão via checkbox inline, PATCH direto — não pelo
formulário.** `TarefaForm` não tem campo `concluida`; a troca de estado
concluída/pendente é uma ação de 1 clique (`alterarConclusao(id,
concluida)`, PATCH parcial), separada do fluxo de editar
descrição/data/plantio.

**Painel (RF12) agrupa por talhão na própria página do Dashboard — sem
nova rota de detalhe de talhão.** Não existe hoje nenhuma página de
detalhe de talhão (só cadastro, dentro de Propriedades); criar uma rota
`/talhoes/:id` só para isso seria escopo não pedido por nenhum outro RF
ainda. "Entrar em cada talhão separadamente" é atendido agrupando as
tarefas pendentes por talhão dentro do próprio painel.

**Painel mostra toda tarefa pendente (`concluida=false`), qualquer data —
atrasadas com destaque visual.** Não filtra por data (não é só "vence
hoje"); tarefas com `data` no passado ganham destaque (texto vermelho) mas
continuam na mesma lista agrupada.

**Painel é acionável — mesmo checkbox de conclusão da página de
Tarefas.** Reaproveita o componente `TarefaItem` (ver Estrutura de
arquivos), cada página com sua própria `useMutation` chamando
`alterarConclusao`.

**`TarefasPage` lista só pendentes por padrão, com link para ver
concluídas.** Mesmo racional do painel: foco no que precisa ser feito. Um
link/toggle ("Ver concluídas") revela a lista completa, ordenada por data.

**Extração do helper de mapeamento de erro de mutação, agora com 3
consumidores.** `InsumoForm` e `AplicacaoInsumoForm` (fatia 3a) e
`TarefaForm` (esta fatia) repetiam o mesmo bloco de `useEffect` mapeando
`ApiError.body` para `setError`. Nesta fatia isso é extraído para um hook
genérico `useMapeamentoErroFormulario<T>` em `lib/mutation-errors.ts`
(genérico sobre o tipo do formulário, não um hook por entidade — decisão
explícita do usuário, 2026-08-03, mesmo depois de ele já ter adiado essa
extração na 3a). `InsumoForm.tsx` e `AplicacaoInsumoForm.tsx` são
refatorados para usar o hook, sem mudança de comportamento.

**RF06/RF07 permanecem fora de escopo.** Cogitado na spec da 3a como
"candidato natural" para esta fatia, mas nenhuma pergunta de brainstorm
desta fatia levantou necessidade real de exibir dias-restantes-de-ciclo ou
data-segura-de-colheita no painel — fica para quando houver esse sinal.

**Mesma stack e convenções das fatias anteriores**: react-hook-form + zod,
TanStack Query, Vitest + React Testing Library, `npx tsc -b` obrigatório em
toda revisão de task.

## Estrutura de arquivos

```
frontend/src/
├── lib/
│   └── mutation-errors.ts    — NOVO: hook useMapeamentoErroFormulario<T>, genérico
├── api/
│   └── tarefas.ts            — tipo Tarefa + listarTarefas/criarTarefa/atualizarTarefa/excluirTarefa/alterarConclusao
├── components/
│   ├── TarefaForm.tsx         — react-hook-form + zod, criar/editar (sem campo concluida)
│   ├── TarefaItem.tsx         — apresentacional: checkbox + descricao + data, reusado por TarefasPage e DashboardPage
│   ├── InsumoForm.tsx         — MODIFICADO: usa useMapeamentoErroFormulario em vez do useEffect inline
│   └── AplicacaoInsumoForm.tsx — MODIFICADO: idem
├── pages/
│   ├── TarefasPage.tsx        — lista pendentes (com link "ver concluídas") + criar/editar/excluir + checkbox
│   └── DashboardPage.tsx      — REESCRITO: painel RF12, tarefas pendentes agrupadas por talhão
├── layout/
│   └── AppShell.tsx           — MODIFICADO: + link de nav pra /tarefas
└── routes.tsx                 — MODIFICADO: + rota protegida /tarefas
```

`api/tarefas.ts` segue o mesmo padrão fino sobre `apiRequest<T>()` das
fatias anteriores. `alterarConclusao` é uma função separada de
`atualizarTarefa` porque manda só `{concluida}` no corpo (PATCH parcial
real, não um PATCH com o objeto inteiro).

`lib/mutation-errors.ts` exporta um único hook:

```ts
export function useMapeamentoErroFormulario<T extends FieldValues>(
  erro: ApiError | null | undefined,
  setError: UseFormSetError<T>,
  camposConhecidos: readonly Path<T>[],
): void
```

Mesma lógica hoje duplicada em `InsumoForm`/`AplicacaoInsumoForm`: para
cada campo em `camposConhecidos`, se `erro.body[campo]` for um array de
string, chama `setError(campo, {message: mensagens[0]})`; se nenhum campo
bateu, `setError('root', {message: detail ?? erro.message})`.

## Navegação

Uma rota nova (`/tarefas`), protegida por `ProtectedRoute`, linkada no nav
do `AppShell`. `/` (painel) já existe como rota — só o conteúdo de
`DashboardPage` é reescrito.

## Tarefas

`TarefasPage`: `useQuery(['tarefas'])`, `useQuery(['plantios'])`,
`useQuery(['talhoes'])`, `useQuery(['culturas'])` (reaproveitando cache do
TanStack Query se essas páginas já foram visitadas nesta sessão) — as 3
últimas só para reconstruir o label do plantio (`"{cultura.nome} —
{talhao.nome} — {data_plantio}"`, mesma lógica de `nomeTalhao`/
`nomeCultura` já usada em `PlantiosPage.tsx`/`AplicacoesPage.tsx`).

Por padrão mostra só tarefas com `concluida === false`, ordenadas por
`data` ascendente. Link "Ver concluídas" alterna para mostrar todas
(incluindo `concluida === true`, estas com estilo riscado/cinza).

Cada linha usa `TarefaItem` (checkbox + descrição + label do plantio +
data formatada `dd/mm/aaaa`) mais botões inline "Editar"/"Excluir". Tarefa
atrasada (`data < hoje` e não concluída) com texto vermelho. Botão
"+ Tarefa" no topo abre `TarefaForm`.

Checkbox: `useMutation({mutationFn: alterarConclusao})`, invalida
`['tarefas']` no sucesso. `onError` mostra uma mensagem curta inline junto
à tarefa (`erroConclusao`, string ou null, uma por página) — mesmo
princípio que a revisão final da 3a cobrou em `AplicacoesPage` (nenhuma
mutação fica sem tratamento de erro, mesmo as "simples"). Some ao tentar
de novo com sucesso ou ao trocar de tarefa.

Exclusão de tarefa: `ConfirmDialog` simples ("Tem certeza que deseja
excluir esta tarefa?"), sem pré-checagem — nada referencia `Tarefa` via
FK.

`TarefaForm` (react-hook-form + zod): campos `plantio` (select, mesmo tipo
`PlantioOpcao` já exportado por `AplicacaoInsumoForm.tsx`), `descricao`
(texto obrigatório), `data` (input `type="date"`). Erro de mutação via
`useMapeamentoErroFormulario`, campos conhecidos:
`['plantio', 'descricao', 'data']`.

## Dashboard (RF12)

`DashboardPage`: `useQuery(['tarefas'])`, `useQuery(['plantios'])`,
`useQuery(['talhoes'])`. Filtra tarefas com `concluida === false`
(qualquer `data`), agrupa por `plantio.talhao` → nome do talhão. Grupos
ordenados alfabeticamente por nome do talhão; tarefas dentro de cada grupo
ordenadas por `data` ascendente. Cada tarefa renderizada com `TarefaItem`
(mesmo checkbox PATCH-direto de `TarefasPage`, mutação própria desta
página). Talhão sem tarefa pendente não aparece. Nenhuma tarefa pendente
em lugar nenhum → mensagem "Nenhuma tarefa pendente."

Mantém a saudação existente ("Bem-vindo, {usuario}") acima do painel.

## Erros e loading

- **Loading:** texto simples "Carregando..." — mesmo padrão das fatias
  anteriores. `TarefasPage`/`DashboardPage` esperam todas as suas queries.
- **Erro de fetch:** mensagem inline + botão "Tentar novamente"
  (`refetch()`) — mesmo padrão. `DashboardPage`/`TarefasPage` cobrem
  `isError` de todas as queries relevantes (lição da revisão final da 3a:
  não checar só a query principal).
- **Erro de mutação de formulário:** via `useMapeamentoErroFormulario`,
  mesmo comportamento observável de antes (só a implementação muda de
  lugar).
- **`AuthExpiredError`:** já tratado globalmente.

## Testes

Mesmo padrão das fatias anteriores (Vitest + RTL + `user-event`, mock de
`apiRequest`):

- **`lib/mutation-errors.ts`:** teste do hook isolado (via um componente
  de teste mínimo ou `renderHook`) cobrindo: erro com campo conhecido
  mapeado, erro sem campo conhecido cai no `root`.
- **`InsumoForm`/`AplicacaoInsumoForm`:** testes existentes continuam
  passando sem alteração de asserção (só a implementação interna muda) —
  confirma que a refatoração não regrediu comportamento.
- **`api/tarefas.ts`:** um teste por função, incluindo `alterarConclusao`
  confirmando que manda só `{concluida}` no corpo.
- **`TarefaForm`:** validação de campos obrigatórios; erro 400 simulado
  com chave de campo reflete no campo certo; erro sem chave reconhecida
  mostra mensagem geral.
- **`TarefaItem`:** renderiza descrição/data/checkbox; clique no checkbox
  chama o callback com o valor invertido; tarefa atrasada recebe a classe
  de destaque.
- **`TarefasPage`:** lista só pendentes por padrão; "Ver concluídas" revela
  as concluídas; criar tarefa via formulário aparece na lista; editar
  atualiza a linha; excluir remove a linha; clicar no checkbox marca como
  concluída e a tarefa some da lista de pendentes (sem "ver concluídas"
  ativo).
- **`DashboardPage`:** tarefas pendentes agrupadas corretamente por
  talhão; talhão sem pendências não aparece; tarefa atrasada com destaque;
  nenhuma pendência mostra a mensagem vazia; checkbox no painel também
  marca como concluída (mutação própria da página, não da `TarefasPage`).
- **`routes.tsx`:** 1 teste novo para `/tarefas` (rota + nav).

## Fora de escopo (fatias seguintes)

- RF06/RF07 (dias restantes de ciclo, data segura de colheita) — ainda sem
  sinal de necessidade real no painel.
- Página de detalhe de talhão (`/talhoes/:id`) — o agrupamento no painel
  cobre o RF12 sem essa rota nova.
- Filtro de tarefas por plantio em `/tarefas` — sem sinal de necessidade
  ainda.
- Fluxo de push (permissão, subscribe, service worker, endpoint de VAPID
  public key) — fatia 3c.
- Colheita, financeiro — fatia 4.
- Ícones reais, prompt de instalação, offline shell — fatia 5.
