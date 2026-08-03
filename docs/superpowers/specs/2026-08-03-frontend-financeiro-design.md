# Design — Frontend: financeiro (Task #8, fatia 4b/5)

## Contexto

Fatia 4a (colheita + RF07) está mergeada. Esta é a segunda e última
sub-fatia da fatia 4 original ("colheita + financeiro"). Backend de
`Trabalhador`, `Diaria`, `LancamentoFinanceiro` e da ação
`pagar_diarias_pendentes` (RF08) já existe inteiro, testado, desde os
Tasks #6/#17-19. Falta só o frontend.

## Contrato real do backend (confirmado lendo `lagoagro/finance/`)

- `GET/POST/PATCH/DELETE /api/trabalhadores/` — CRUD completo
  (`TrabalhadorViewSet`, `usuario_lookup="usuario"`).
  `TrabalhadorSerializer`: `{id, nome, valor_diaria, ativo}`.
  `valor_diaria` é `DecimalField` — string.
- `POST /api/trabalhadores/{id}/pagar-diarias/` — sem corpo, retorna um
  **array** de `LancamentoFinanceiroSerializer` (os lançamentos criados,
  um por plantio com diárias pendentes daquele trabalhador). Agrupa por
  plantio (soma o valor, usa a data mais antiga/mais recente na
  descrição), sempre `setor="mao_de_obra"`.
- `GET/POST/PATCH/DELETE /api/diarias/` — CRUD, mas com restrições:
  `DiariaSerializer`: `{id, trabalhador, plantio, data, valor, lancamento}`,
  `valor`/`lancamento` são **`read_only`** — o backend sempre calcula
  `valor` (= `trabalhador.valor_diaria` na criação) e `lancamento` (setado
  só pela ação `pagar-diarias`). O formulário de criar/editar só manda
  `{trabalhador, plantio, data}`.
  - Editar uma diária **já paga** (`lancamento` não nulo) retorna `400`
    com `"Não é possível alterar uma diária já paga."` (validação no
    serializer, chave `non_field_errors`/root, não um campo específico).
  - Excluir uma diária já paga retorna **`400`** (não 409 — é um check
    manual em `DiariaViewSet.destroy`, diferente do padrão `ProtectedError`
    de `AplicacaoInsumo`) com `"Não é possível excluir uma diária já
    paga."`.
  - `UniqueConstraint(trabalhador, data)` — duas diárias do mesmo
    trabalhador no mesmo dia retorna `400` (erro de campo não-específico,
    cai no fallback `root` do mapeamento de erro).
- `GET/POST/PATCH/DELETE /api/lancamentos-financeiros/` — CRUD completo
  (`LancamentoFinanceiroViewSet`). `LancamentoFinanceiroSerializer`:
  `{id, plantio, valor, data, descricao, setor}`. `setor` é um dos 6
  valores já definidos (`mao_de_obra`, `insumos`, `maquinario`,
  `transporte`, `manutencao`, `outros`). `Diaria.lancamento` é
  `on_delete=PROTECT` — excluir um `LancamentoFinanceiro` referenciado por
  alguma diária paga é bloqueado pelo banco (`409`, mesmo exception
  handler global de `AplicacaoInsumo`).

## Decisões de abordagem

**2 páginas: "Trabalhadores" (com diárias aninhadas) + "Financeiro"
(lançamentos).** Decisão do usuário (2026-08-03). `TrabalhadoresPage`
segue exatamente o padrão de lista expansível já estabelecido em
`PropriedadesPage`/`TalhaoForm` (fatia 2): cada trabalhador expande pra
mostrar suas diárias, com um formulário de diária que recebe
`trabalhadorId` como prop fixa (não um select) — o mesmo padrão de
`TalhaoForm` receber `propriedadeId` fixo.

**Trabalhador inativo continua aparecendo no select de novas diárias.**
Decisão explícita do usuário (2026-08-03, não a recomendada) — nenhum
filtro por `ativo` na lista de trabalhadores usada como opção de diária.

**Diárias pagas não mostram Editar/Excluir — mostram um indicador
"Paga".** Decisão de UX (não backend): em vez de deixar o usuário clicar
e levar um 400, a `DiariaItem`/linha de diária já esconde as ações quando
`diaria.lancamento !== null`, mostrando só um texto "Paga" no lugar. O
backend continua sendo a rede de segurança real (o 400 existe e é
testado), a UI só evita expor uma ação que sempre falharia — mesmo
racional do botão de push escondido quando o navegador não suporta (fatia
3c).

**"Pagar diárias pendentes" com pré-checagem de contagem.** Decisão do
usuário (2026-08-03): antes de abrir o `ConfirmDialog`, conta quantas
diárias daquele trabalhador têm `lancamento === null` (reaproveitando
`useQuery(['diarias'])` já carregada) e mostra no diálogo — mesmo padrão
da pré-checagem de exclusão de Insumo (fatia 3a). Após confirmar, mostra
uma mensagem de sucesso com quantos lançamentos foram criados (a ação
retorna a lista).

**`LancamentoFinanceiro` com pré-checagem de exclusão, mesma lógica do
Insumo.** Antes de excluir um lançamento, conta quantas `Diaria`
referenciam aquele `lancamento.id` (reaproveitando `useQuery(['diarias'])`
se já carregada) e mostra a contagem — o 409 do backend continua como
rede de segurança se a contagem ficar desatualizada.

**Sem restrição extra no frontend para editar um lançamento gerado por
"pagar diárias".** O backend não distingue lançamentos manuais dos
gerados automaticamente (mesmo model, mesma serializer) — o frontend
também não vai inventar essa distinção. Editar o valor de um lançamento
de mão de obra já pago é tecnicamente possível e gera uma inconsistência
entre o valor do lançamento e a soma das diárias — **risco conhecido,
fora de escopo desta fatia** (exigiria validação nova no backend).

**Financeiro mostra total geral.** Decisão do usuário (2026-08-03): soma
de `valor` de todos os lançamentos visíveis, exibida no topo da lista.

**Mesma stack e convenções**: react-hook-form + zod, TanStack Query,
`useMapeamentoErroFormulario`, `ConfirmDialog`, `lib/plantio-labels.ts`
(recém-extraído) reaproveitado pelas 2 páginas novas, `npx tsc -b`
obrigatório.

## Estrutura de arquivos

```
frontend/src/
├── api/
│   ├── trabalhadores.ts    — Trabalhador + CRUD + pagarDiariasPendentes(id)
│   ├── diarias.ts          — Diaria + listar/criar/atualizar/excluir
│   └── lancamentos.ts      — LancamentoFinanceiro + ROTULOS_SETOR + CRUD
├── components/
│   ├── TrabalhadorForm.tsx — criar/editar (nome, valor_diaria, ativo)
│   ├── DiariaForm.tsx      — criar/editar (plantio, data), trabalhadorId fixo
│   └── LancamentoForm.tsx  — criar/editar (plantio, valor, data, descricao, setor)
├── pages/
│   ├── TrabalhadoresPage.tsx — lista expansível + diárias aninhadas + pagar-diárias
│   └── FinanceiroPage.tsx    — lista de lançamentos + total geral
├── layout/
│   └── AppShell.tsx        — MODIFICADO: + links de nav
└── routes.tsx               — MODIFICADO: + rotas /trabalhadores, /financeiro
```

## `TrabalhadoresPage`

`useQuery(['trabalhadores'])`, `useQuery(['diarias'])`,
`useQuery(['plantios'])`, `useQuery(['talhoes'])`,
`useQuery(['culturas'])` (as 3 últimas só pra `labelPlantio`, de
`lib/plantio-labels.ts`). Lista expansível (mesmo padrão
`expandidas: Set<number>` de `PropriedadesPage`): cada trabalhador mostra
nome/valor diária/ativo, botões Editar/Excluir, e ao expandir mostra suas
diárias (`labelPlantio` + data + valor + "Paga"/ações) mais um botão
"+ Diária" e "Pagar diárias pendentes".

Exclusão de trabalhador: `Diaria.trabalhador` é `on_delete=PROTECT`
incondicional (mesmo diárias já pagas bloqueiam) — então excluir um
trabalhador com qualquer diária (paga ou não) falha com `409`.
Pré-checagem conta **todas** as diárias daquele trabalhador (não só
pendentes) antes de abrir o `ConfirmDialog`, mesmo padrão do Insumo.

Pagar diárias: `ConfirmDialog` mostrando "Isso vai gerar N lançamento(s)
de mão de obra." (conta plantios distintos com diária pendente daquele
trabalhador) ou "Nenhuma diária pendente para pagar." (desabilita
confirmar nesse caso). Sucesso mostra "N lançamento(s) criado(s)."

## `FinanceiroPage`

`useQuery(['lancamentos'])`, mais `plantios`/`talhoes`/`culturas` (label)
e `useQuery(['diarias'])` (só pra pré-checagem de exclusão). Lista
ordenada por data mais recente, mostrando plantio/data/descrição/setor/
valor. Total geral = soma de `valor` (convertido de string) de todos os
lançamentos, exibido no topo.

## Erros e loading

Mesmo padrão das fatias anteriores: "Carregando...", "Tentar novamente"
refazendo todas as queries da página, `useMapeamentoErroFormulario` nos
3 formulários novos.

## Testes

Mesmo padrão das fatias anteriores — um arquivo de teste por módulo de
api, por formulário, por página; cobertura dos casos de negócio citados
acima (diária paga sem ações, pré-checagem de contagem, total geral,
pagar-diárias com 0 pendentes).

## Fora de escopo

- Validação de consistência entre o valor de um `LancamentoFinanceiro`
  de mão de obra e a soma das diárias que ele representa — risco
  conhecido, já registrado acima, exigiria mudança de backend.
- Filtro/agrupamento por setor ou por período no Financeiro — lista
  simples com total, sem agregações além disso.
- Ícones reais, prompt de instalação — fatia 5.
