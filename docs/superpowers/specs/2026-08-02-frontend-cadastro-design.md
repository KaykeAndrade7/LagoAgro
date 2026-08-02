# Design — Frontend: cadastro (Task #8, fatia 2/5)

## Contexto

Fatia 1 (scaffold + auth) está mergeada em `master` — build tooling, JWT
auth (access em memória, refresh single-flight, `AuthExpiredError`
centralizado), roteamento protegido (`ProtectedRoute`), `lib/api-client.ts`
e `lib/query-client.ts` prontos, e o scaffold do PWA (sem push ainda).
Nenhuma tela de domínio existe ainda.

Decomposição das 5 fatias (ver
`docs/superpowers/specs/2026-08-01-frontend-scaffold-auth-design.md`):

1. Scaffold + auth shell (mergeada)
2. **Cadastro — propriedades/talhões, culturas, plantios (este documento)**
3. Insumos + aplicações + tarefas + dashboard (RF12) + fluxo de push
4. Colheita + financeiro
5. Polimento PWA

Este documento cobre a primeira fatia a consumir dados reais do backend
via `useQuery`/`useMutation` — o primeiro uso real de TanStack Query no
projeto além do `QueryClientProvider` vazio da fatia 1.

## Contrato real do backend (confirmado lendo `lagoagro/{properties,crops,plantings}/`)

- `GET/POST/PATCH/DELETE /api/propriedades/` — CRUD completo.
  `PropriedadeSerializer`: `{id, nome}`. Escopado por usuário
  (`UsuarioScopedQuerySetMixin`, `usuario_lookup="usuario"`).
- `GET/POST/PATCH/DELETE /api/talhoes/` — CRUD completo.
  `TalhaoSerializer`: `{id, propriedade, nome, area, tipo_solo}`. O campo
  `propriedade` é o ID da propriedade (FK), já restrito às propriedades do
  usuário autenticado pelo próprio serializer. `area` é `DecimalField` —
  chega como string no JSON (ex: `"12.50"`), não número.
- `GET /api/culturas/` — **somente leitura** (`ReadOnlyModelViewSet`, sem
  `usuario_lookup` — culturas não são escopadas por usuário, são um
  catálogo compartilhado). `CulturaSerializer`: `{id, nome, ciclo_dias,
  fases: [{id, nome, dia_inicio, dia_fim}, ...]}`, fases já vêm aninhadas e
  ordenadas por `dia_inicio`. **Não existe endpoint de escrita** — cadastro
  de cultura é responsabilidade do admin Django, fora do escopo do usuário
  final e desta fatia.
- `GET/POST/PATCH/DELETE /api/plantios/` — CRUD completo.
  `PlantioSerializer`: `{id, talhao, cultura, data_plantio, status}`.
  `talhao` é o ID do talhão (FK, restrito aos talhões do usuário pelo
  serializer); `cultura` é o ID da cultura (sem restrição de usuário, já
  que culturas são catálogo compartilhado); `status` é um de
  `"em_andamento" | "colhido" | "cancelado"`; `data_plantio` é uma data
  `"YYYY-MM-DD"`.

Todos os quatro roteados via `DefaultRouter` em `core/urls.py` sob
`/api/` — sem paginação customizada (paginação default do DRF, se houver,
não é assumida por este documento; a fatia 3 é quem lida com dashboards
que agregam muitos registros).

## Decisões de abordagem

**react-hook-form + zod** para os três formulários (Propriedade, Talhão,
Plantio) — decisão de stack válida para as fatias seguintes também.
Motivo: essas telas têm validação de verdade pela primeira vez (campos
obrigatórios, tipos numéricos, FK obrigatória) e as fatias 3–4 somam mais
~8 formulários de domínio (insumo, aplicação, tarefa, colheita, lançamento
financeiro). Escrever `useState` + validação manual replicaria a mesma
lógica em cada um; `react-hook-form` cuida do estado de campo/erro e
`zod` declara a validação uma vez por entidade, reaproveitável entre
criar/editar.

**Sem camada de hooks customizados por entidade nesta fatia** (ex: nada de
`useTalhoes()`). Cada entidade tem uso em uma única página nesta fatia —
uma camada de hooks intermediária seria abstração sem consumidor duplo
ainda. Se a fatia 3 (que também consome `culturas`/`talhoes` para popular
selects de insumo/tarefa) mostrar reuso real, extraio hooks então.

**Sem otimistic update** nas mutações — `onSuccess` de cada
`useMutation` invalida a query correspondente e deixa o refetch buscar o
estado real do servidor. Simplicidade sobre performance percebida: volume
de dados de um produtor pequeno não justifica a complexidade de
reconciliar estado otimista com uma cascata de invalidações (excluir
propriedade invalida talhões E plantios).

**Contagem de cascata client-side, sem endpoint novo.** Ver seção
"Exclusão em cascata" abaixo — as contagens mostradas nos diálogos de
confirmação vêm de dados já buscados por outras queries em cache, nunca
de uma chamada nova ao backend feita só para contar.

## Estrutura de arquivos

```
frontend/src/
├── api/
│   ├── propriedades.ts     — tipo Propriedade + listarPropriedades/criarPropriedade/atualizarPropriedade/excluirPropriedade
│   ├── talhoes.ts           — tipo Talhao + listarTalhoes/criarTalhao/atualizarTalhao/excluirTalhao
│   ├── culturas.ts          — tipo Cultura (+ FaseCultura aninhada) + listarCulturas
│   └── plantios.ts          — tipo Plantio + listarPlantios/criarPlantio/atualizarPlantio/excluirPlantio
├── components/
│   ├── ConfirmDialog.tsx    — modal de confirmação genérico (título, mensagem, onConfirm/onCancel)
│   ├── PropriedadeForm.tsx  — react-hook-form + zod, criar/editar
│   ├── TalhaoForm.tsx       — idem, inclui select de propriedade
│   └── PlantioForm.tsx      — idem, inclui select de talhão e de cultura
├── pages/
│   ├── PropriedadesPage.tsx — lista expansível propriedade → talhões aninhados
│   ├── CulturasPage.tsx     — lista read-only, fases expandidas, sem formulário
│   └── PlantiosPage.tsx     — lista + criar/editar/excluir
├── layout/
│   └── AppShell.tsx         — MODIFICADO: adiciona links de nav pra /propriedades, /culturas, /plantios
└── routes.tsx               — MODIFICADO: + rotas protegidas /propriedades, /culturas, /plantios
```

Cada `api/<entidade>.ts` exporta o tipo TypeScript da entidade (refletindo
o serializer real, incluindo `area: string` em `Talhao`) e funções finas
sobre `apiRequest<T>()` de `lib/api-client.ts` — nenhuma lógica além de
montar path/método/corpo.

## Navegação

Três rotas novas, cada uma como página própria (`/propriedades`,
`/culturas`, `/plantios`), protegidas por `ProtectedRoute` (já existente),
linkadas por um nav simples no `AppShell` junto ao link do dashboard e ao
botão de logout já existentes. Escala bem quando as fatias 3–4
adicionarem mais páginas ao mesmo nav.

## Propriedades e Talhões

Uma página só (`PropriedadesPage`): lista de propriedades, cada uma
expansível para revelar seus talhões. Dentro de cada propriedade
expandida, um botão "+ Talhão" abre `TalhaoForm` com o campo `propriedade`
já preenchido (não é um select nesse fluxo — o talhão nasce dentro do
contexto de uma propriedade já aberta). Um botão "+ Propriedade" no topo
da página abre `PropriedadeForm`.

Dados: `useQuery(['propriedades'], listarPropriedades)` e
`useQuery(['talhoes'], listarTalhoes)` (lista completa, sem filtro no
servidor) — cada propriedade expandida filtra a lista de talhões
client-side por `talhao.propriedade === propriedade.id`. Evita N+1 de
requisições ao expandir várias propriedades; aceitável porque o volume de
talhões de um produtor pequeno é baixo (RF/RNF não impõem paginação aqui).

Editar/excluir talhão e editar/excluir propriedade ficam como ações
inline em cada item da lista (ícone ou botão de texto "Editar"/"Excluir").

## Culturas

`CulturasPage`: `useQuery(['culturas'], listarCulturas)`, lista read-only.
Cada cultura mostra `nome` e `ciclo_dias`; expansível para mostrar suas
`fases` (nome, `dia_inicio`–`dia_fim`) já vindas aninhadas na resposta —
sem query adicional. Nenhum formulário, nenhum botão de criar/editar/
excluir nesta página — é puramente informativa (o produtor consulta
"quantos dias faltam pra a fase X" indiretamente ao ver a fase corrente de
um plantio, não editando o catálogo).

## Plantios

`PlantiosPage`: `useQuery(['plantios'], listarPlantios)` para a lista, e
`useQuery(['talhoes'])` + `useQuery(['culturas'])` (reaproveitando cache
do TanStack Query se o usuário já visitou as outras páginas nesta sessão)
só para popular os `<select>` de `PlantioForm` com `{id, nome}` de talhão
e `{id, nome}` de cultura.

`PlantioForm` (react-hook-form + zod): campos `talhao` (select), `cultura`
(select), `data_plantio` (input `type="date"`), `status` (select com as 3
opções do backend). Criar e editar reaproveitam o mesmo formulário
(schema zod idêntico; editar só pré-popula os valores).

Lista mostra `cultura.nome`, `talhao.nome`, `data_plantio` formatada
(`dd/mm/aaaa`), `status` (rótulo em português: "Em andamento" / "Colhido"
/ "Cancelado"), com ações inline de editar/excluir.

## Exclusão em cascata

Backend: `Talhao.propriedade` é `CASCADE`, `Plantio.talhao` é `CASCADE`
(confirmado em `properties/models.py` e `plantings/models.py`) — excluir
uma Propriedade cascateia para seus Talhões e daí para os Plantios
daqueles talhões. Excluir um Talhão cascateia para seus Plantios.

- **Excluir Talhão:** `ConfirmDialog` mostra contagem de plantios daquele
  talhão, derivada de `useQuery(['plantios'])` (cache do TanStack Query —
  busca na hora se o usuário ainda não visitou `/plantios` nesta sessão)
  filtrada por `plantio.talhao === talhao.id`. Mensagem: "Isso também
  excluirá N plantio(s) registrado(s) neste talhão." (omitida se N = 0).
- **Excluir Propriedade:** a lista de talhões daquela propriedade já está
  em memória (é a mesma lista usada para renderizar a expansão). Mensagem:
  "Isso também excluirá N talhão(ões) e todos os plantios registrados
  neles." — sem contagem exata de plantios aqui (evitaria cruzar
  propriedade→talhões→plantios só para exibir um número; a contagem de
  talhões já comunica o impacto real).
- Nenhuma dessas contagens depende de endpoint novo no backend.

## Erros e loading

- **Loading:** texto simples "Carregando..." por lista, sem spinner
  customizado — consistente com o minimalismo do restante do frontend.
- **Erro de fetch:** mensagem inline na página (ex: "Não foi possível
  carregar as propriedades.") com botão "Tentar novamente" chamando
  `refetch()` do `useQuery`.
- **Erro de mutação:** corpo de erro DRF (`ApiError.body`, de
  `lib/api-client.ts`) mapeado para o campo correspondente do formulário
  quando as chaves batem (ex: `{"nome": ["Este campo é obrigatório."]}`
  vira erro no campo `nome` via `setError` do react-hook-form); mensagem
  geral do formulário quando não há chave de campo correspondente (ex:
  erro de rede, erro 500).
- **`AuthExpiredError`:** já tratado globalmente pelo handler central da
  fatia 1 (`setAuthExpiredHandler`) — nenhuma página desta fatia precisa
  de tratamento próprio para isso.

**Nota de implementação (revisão final do branch, fatia 2/5):** o mapeamento
de erro de mutação descrito acima NÃO foi implementado nesta fatia — as
mutações das três páginas hoje não tratam falha (nem `onError`, nem
`setError` no formulário, nem fechamento do diálogo/formulário em caso de
erro). Adiado explicitamente para a fatia 3, por decisão do usuário
(2026-08-02), para não expandir o escopo desta fatia. Rastrear como
requisito pendente, não reintroduzir silenciosamente sem tratamento.

## Testes

Mesmo padrão da fatia 1 (Vitest + React Testing Library + `user-event`,
mock de `apiRequest` via `vi.mock('../lib/api-client')`):

- **`api/*.ts`:** um teste por função confirmando path/método/corpo (ex:
  `criarTalhao({...})` chama `apiRequest('/talhoes/', {method: 'POST',
  body: ...})`), sem rede real.
- **`PropriedadesPage`:** lista carrega e renderiza; expandir uma
  propriedade mostra só os talhões daquela propriedade; criar propriedade
  via formulário faz o novo item aparecer na lista; excluir propriedade
  com talhões mostra o aviso de cascata com a contagem certa.
- **`CulturasPage`:** lista carrega; expandir uma cultura mostra suas
  fases na ordem certa; nenhum elemento de criar/editar/excluir está
  presente na página (teste negativo).
- **`PlantiosPage`:** selects de talhão/cultura no formulário são
  populados a partir das queries correspondentes; criar plantio faz o
  novo item aparecer na lista com os rótulos certos (nome do talhão, nome
  da cultura, rótulo de status em português); editar um plantio existente
  pré-popula o formulário e reflete a mudança na lista.
- **`ConfirmDialog`:** teste isolado — abre com a mensagem recebida,
  confirmar dispara `onConfirm`, cancelar dispara `onCancel` e nenhum dos
  dois dispara o outro.

## Fora de escopo (fatias seguintes ou fora do frontend)

- CRUD de Cultura pelo usuário final — o backend não permite isso hoje
  (`ReadOnlyModelViewSet`); adicionar essa capacidade seria uma mudança de
  escopo do Task #6 (backend), não desta fatia. Se isso vier a ser
  necessário, precisa de uma decisão própria (não implícita nesta spec).
- Insumos, aplicações, tarefas, dashboard (RF12), fluxo de push — fatia 3.
- Colheita, financeiro — fatia 4.
- Ícones reais, prompt de instalação, offline shell — fatia 5.
- Paginação de listas grandes — não há sinal de que o volume de dados de
  um produtor pequeno precise disso; revisitar se a fatia 3/4 expuser
  listas que cresçam sem limite natural (ex: histórico de aplicações).
