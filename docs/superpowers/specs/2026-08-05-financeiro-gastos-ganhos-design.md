# Design — Financeiro: separar gastos e ganhos

## Contexto

`FinanceiroPage`/`LancamentoFinanceiro` (fatia 4b/5, spec
`2026-08-03-frontend-financeiro-design.md`) só modela gasto — RF08 em
`docs/requirements.md` documenta isso explicitamente como "lançamentos
financeiros (gasto)". Não existe nenhum conceito de receita/ganho no
sistema hoje, nem ligado a `Colheita` (que só registra quantidade por
classificação, sem valor monetário de venda). Usuário pediu (2026-08-05,
já em produção) pra separar gastos e ganhos, com totais de cada e saldo
líquido.

Decidido via brainstorm (2026-08-05) antes desta spec:

- **Ganho = só venda de colheita**, não qualquer entrada de dinheiro.
- **Lançamento de ganho é manual, ligado só ao plantio** — igual ao
  gasto hoje. **Não** fica vinculado a um registro específico de
  `Colheita` (venda parcial ou de várias colheitas juntas é comum,
  1 colheita = 1 venda não bate com a realidade do produtor).
- **Ganho tem categoria**, já pensando em outros tipos de receita
  futuros, mesmo só existindo uma hoje ("Venda de colheita").
- **Mostrar saldo líquido** (ganho − gasto), além dos dois totais
  separados.

## Abordagem escolhida

**Um campo `tipo` novo em `LancamentoFinanceiro` existente** (não um
model `Ganho` separado). Gasto e ganho têm a mesma forma (plantio,
valor, data, descrição, categoria) — só a lista de categorias válidas
muda por tipo. Um model novo duplicaria CRUD/serializer/página/testes
sem ganhar nada em troca. Reaproveita 100% do que a fatia 4b já
construiu (lista, exclusão, vínculo `Diaria.lancamento`).

## Mudanças de backend (`lagoagro/finance/`)

**`LancamentoFinanceiro.tipo`** — `CharField` com choices
`[("gasto", "Gasto"), ("ganho", "Ganho")]`, `default="gasto"` (migração
faz backfill; hoje não existe nenhum `LancamentoFinanceiro` em produção,
mas dev local pode ter fixtures/dados de teste que precisam do default
pra migrar sem erro).

**`SETOR_CHOICES`** ganha uma entrada nova: `("venda_colheita", "Venda
de colheita")`. `"outros"` já existente continua servindo pros dois
tipos (não duplicar uma opção "outros" por tipo).

```python
GASTO_SETORES = {"mao_de_obra", "insumos", "maquinario", "transporte", "manutencao", "outros"}
GANHO_SETORES = {"venda_colheita", "outros"}
```

**`LancamentoFinanceiroSerializer`**: campo `tipo` adicionado a
`fields`. `validate()` novo rejeita combinação inválida de
`tipo`×`setor` (ex.: `tipo="ganho"` com `setor="insumos"`) com erro
`non_field_errors` — mesmo padrão de `DiariaSerializer.validate()` já
existente na mesma app.

**`pagar_diarias_pendentes`** (a `@action` que gera
`LancamentoFinanceiro` automático a partir de diárias pendentes) passa a
setar `tipo="gasto"` explicitamente na criação — hoje só seta `setor`.

**Migração**: uma migração de schema (`AddField tipo`) — sem migração
de dados manual necessária, o `default="gasto"` do field cuida do
backfill.

## Mudanças de frontend

**`api/lancamentos.ts`**: `LancamentoFinanceiro`/`LancamentoFinanceiroInput`
ganham `tipo: 'gasto' | 'ganho'`. Novo `ROTULOS_TIPO` (`{gasto: 'Gasto',
ganho: 'Ganho'}`). `SETOR_CHOICES`/`ROTULOS_SETOR` ganham
`venda_colheita`. Novo `SETORES_POR_TIPO: Record<'gasto'|'ganho',
SetorLancamento[]>` pra filtrar as opções do select por tipo, tanto no
formulário quanto (se necessário) na página.

**`LancamentoForm`**: campo `tipo` novo (select ou radio, Gasto/Ganho),
antes do campo `setor`, com **`"gasto"` como valor padrão ao criar**
(mesmo default do model, é o caso mais comum hoje). Editar um lançamento
existente pré-popula com o `tipo` real dele, como qualquer outro campo.
`setor` observa `watch('tipo')` (mesmo padrão já usado em `ColheitaForm`
pra `watch('plantio')`) e mostra só as opções de
`SETORES_POR_TIPO[tipoSelecionado]`. Trocar de tipo com uma categoria já
selecionada que não é mais válida reseta `setor` pro primeiro valor
válido do novo tipo (evita submeter uma combinação inválida por
inércia da UI).

**`FinanceiroPage`**:
- Filtro local (não query nova) com 3 estados mutuamente exclusivos —
  Todos / Gastos / Ganhos — mesmo padrão visual dos pills de navegação
  do `AppShell` (ativo preenchido de verde, inativos em contorno), **não**
  o toggle booleano "Ver concluídas" de `TarefasPage` (esse é show/hide
  de 2 estados, aqui são 3 mutuamente exclusivos). Filtra só a lista
  renderizada.
- **Totais sempre calculados sobre todos os lançamentos, independente
  do filtro ativo** — trocar o filtro não muda os totais, só a lista
  abaixo. Substituem o card único "Total: R$ X" atual por três valores:
  Total gasto, Total ganho, Saldo líquido (ganho − gasto).
- Cada linha da lista: valor prefixado com `+` (ganho) ou `−` (gasto).
  **Cor**: ganho em `text-accent` (verde já estabelecido), gasto em
  `text-ink` (cor normal) — não uso `amber`/`rust`, que o `DESIGN.md`
  já documenta como reservados só pra urgência de tarefa (Atrasada/Hoje),
  não pra sinalização financeira. Saldo líquido segue a mesma regra:
  verde se ≥ 0, `text-ink` normal se negativo (não vira "vermelho de
  alerta" — evita inventar uma terceira cor semântica fora do sistema
  já fechado).

## Testes

**Backend**: `validate()` rejeita `tipo`×`setor` incompatível (2 casos:
gasto com categoria de ganho, ganho com categoria de gasto); serializer
aceita/retorna `tipo`; `pagar_diarias_pendentes` cria lançamento com
`tipo="gasto"` (atualizar teste existente que já cobre essa ação, se o
teste não checar `tipo` ainda vai passar por acidente — adicionar
assert explícito).

**Frontend**: `LancamentoForm` mostra categorias diferentes conforme
`tipo` selecionado, e reseta `setor` inválido ao trocar de tipo;
`FinanceiroPage` calcula os 3 totais corretamente com fixture mista
(gasto + ganho); filtro esconde/mostra as linhas certas sem afetar os
totais exibidos.

## Fora de escopo

- Qualquer tipo de ganho além de venda de colheita (assinado como
  decisão do usuário no brainstorm — categoria fica pronta pra crescer,
  mas não inventa outras entradas hoje).
- Vínculo entre um lançamento de ganho e um registro específico de
  `Colheita` — decisão explícita de manter manual/desacoplado.
- Retrofit de filtro/agrupamento por período — só o filtro Todos/Gastos/
  Ganhos, nada de intervalo de datas.
- Alterar o comportamento de exclusão/proteção já existente
  (`Diaria.lancamento` como `PROTECT`) — `tipo` não muda nenhuma regra
  de exclusão já estabelecida.
