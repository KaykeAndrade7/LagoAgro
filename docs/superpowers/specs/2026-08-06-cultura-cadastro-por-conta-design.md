# Design — Cadastro de cultura/variedade por conta

## Contexto

`crops.Cultura` hoje é a única entidade do domínio que **não** segue o
modelo multi-tenant do resto do sistema (`Propriedade`, `Insumo`,
`Trabalhador` etc., todos com FK `usuario` e scoping via
`UsuarioScopedQuerySetMixin`). É um catálogo global, sem campo `usuario`,
`nome` com `unique=True` em todo o sistema, populado só via management
command `seed_culturas` (Tomate, Pimentão, Batata) e exposto como
`ReadOnlyModelViewSet` — sem create/update/delete pela API.

Pedido do usuário final (pai do usuário principal, via o usuário
principal, 2026-08-06): quer cadastrar variedades diferentes de uma mesma
cultura (ex.: Tomate Cereja, Tomate Italiano, Tomate Santa Cruz), cada uma
com ciclo de dias e fases próprios (confirmado no brainstorm: as
variedades **não** compartilham ciclo/fases entre si). RF02 em
`docs/requirements.md` já previa isso desde o início ("Cadastrar culturas
com ciclo em dias e fases... MVP: pimentão, tomate, batata") — o MVP só
restringiu o cadastro ao seed fixo, sem expor CRUD.

## Abordagem escolhida

**Reaproveitar `Cultura`/`FaseCultura` como estão, só abrir CRUD e
adicionar escopo por conta.** Rejeitada a alternativa de criar um model
`Variedade` novo ligado a uma `Cultura` base: como cada variedade já teria
ciclo e fases 100% próprios (confirmado no brainstorm), a "herança" de uma
cultura-base não agregaria nenhum comportamento real — só duplicaria
model/serializer/formulário/teste, e ainda exigiria migrar `Plantio.cultura`
para apontar a outro lugar. Reaproveitar é literalmente o que RF02 já
pedia.

`Cultura` ganha um campo `usuario` opcional:
- `usuario = None` → cultura **embutida** (as 3 atuais) — visível e
  utilizável por qualquer conta, somente leitura pela API.
- `usuario = <conta>` → cultura **própria** dessa conta — visível só para
  ela, com CRUD completo.

## Mudanças de backend (`lagoagro/crops/`)

**`Cultura.usuario`** — `ForeignKey(settings.AUTH_USER_MODEL,
on_delete=models.CASCADE, null=True, blank=True, related_name="culturas")`.
Migração é só `AddField` — as 3 linhas já existentes ficam com
`usuario=NULL` automaticamente (viram embutidas sem precisar de migração
de dados). `nome` deixa de ter `unique=True` isolado; vira
`UniqueConstraint(fields=["usuario", "nome"], name="unique_cultura_por_usuario")`
(constraint de banco — proteção de última linha; a validação de verdade,
com mensagem legível, é no serializer, ver abaixo).

**`FaseCultura`**: nenhuma mudança de schema. Continua só acessível de
forma aninhada dentro de `Cultura` (sem endpoint próprio).

**`Plantio.cultura`**: nenhuma mudança — continua `PROTECT`, igual hoje,
para embutida e para própria.

**`CulturaViewSet`** (`crops/views.py`): deixa de ser
`ReadOnlyModelViewSet`, vira `ModelViewSet`.
- `get_queryset()`: `Cultura.objects.filter(Q(usuario__isnull=True) |
  Q(usuario=self.request.user)).order_by("nome")` — união de embutidas +
  próprias, nunca vaza cultura de outra conta.
- `perform_create()`: `serializer.save(usuario=self.request.user)` —
  mesmo padrão já usado em `TrabalhadorViewSet.perform_create`
  (`finance/views.py`); ninguém cria cultura embutida pela API.
- `get_object()`: sobrescrito para barrar `update`/`partial_update`/
  `destroy` quando `obj.usuario_id is None` — levanta
  `PermissionDenied` (403) com mensagem "Não é possível editar ou excluir
  uma cultura do catálogo padrão."

**`CulturaSerializer`** (`crops/serializers.py`):
- `fases = FaseCulturaSerializer(many=True)` — deixa de ser `read_only`,
  vira campo de escrita aninhada.
- `somente_leitura = SerializerMethodField()` — `True` quando
  `obj.usuario_id is None`; o frontend usa isso pra decidir se mostra
  ações de editar/excluir, sem duplicar a lógica de ownership no cliente.
- `validate_fases`: rejeita lista vazia ("Cadastre pelo menos uma fase.");
  para cada fase, rejeita `dia_inicio >= dia_fim`.
- `validate_nome`: rejeita nome que já existe (case-insensitive) entre as
  culturas visíveis à conta autenticada (embutidas + próprias, excluindo a
  própria instância em caso de edição) — evita duas entradas "Tomate"
  confusas no mesmo dropdown de plantio.
- `create()`: separa `fases` do resto do payload, cria a `Cultura`
  (usuário já vem setado por `perform_create`), depois
  `FaseCultura.objects.bulk_create` com a lista.
- `update()`: atualiza os campos escalares; se `fases` veio no payload,
  apaga todas as fases existentes (`instance.fases.all().delete()`) e
  recria a partir do payload novo — substituição completa da lista, não
  merge item a item.

**Comportamento de exclusão inalterado**: cultura própria em uso por
algum `Plantio` continua retornando 409 (mecanismo `PROTECT` +
`core/exceptions.py`, já existente, sem mudança).

## Mudanças de frontend

**`api/culturas.ts`**: `Cultura` ganha `somente_leitura: boolean`. Novas
funções `criarCultura`, `atualizarCultura`, `excluirCultura` (mesmo padrão
de `apiRequest` já usado em `listarCulturas`). Tipo `FaseCulturaInput`
(`nome`, `dia_inicio`, `dia_fim`, sem `id`) para o payload de criação.

**`CulturaForm.tsx`** (novo componente): campos `nome` e `ciclo_dias`
(mesmo padrão de `Field`/`Input` dos outros formulários), mais uma lista
dinâmica de fases usando `useFieldArray` do react-hook-form (biblioteca já
usada em todo formulário do app — esta é a primeira lista dinâmica,
padrão novo de UI, ferramenta já conhecida do stack). Cada linha de fase:
`nome`, `dia_inicio`, `dia_fim` + botão de remover; botão "+ adicionar
fase" abaixo da lista. Validação zod: nome obrigatório, ciclo_dias > 0,
ao menos 1 fase, `dia_inicio < dia_fim` em cada fase — espelha as
validações do serializer, pra dar feedback antes de bater na API.

**`CulturasPage.tsx`**:
- `PageHeader` ganha ação "+ Cultura" (mesmo padrão de botão das outras
  páginas), abre `CulturaForm` em modo criação.
- Cada card: se `cultura.somente_leitura`, sem ações (comportamento atual,
  intocado). Se não, ganha ícones de editar/excluir no cabeçalho do card
  (mesmo padrão visual já usado em Talhões/Insumos), abrindo o
  `CulturaForm` em modo edição (pré-preenchido, incluindo fases) ou o
  `ConfirmDialog` padrão do app para exclusão.
- Exclusão com 409 (cultura em uso por plantio) mostra a mensagem de erro
  no próprio `ConfirmDialog`, mesmo padrão já usado em outras páginas
  (`paraApiError`).

## Testes

**Backend**: unicidade de nome por conta (case-insensitive, contra
embutidas e contra próprias); `validate_fases` rejeita lista vazia e
`dia_inicio >= dia_fim`; `get_object` retorna 403 ao tentar editar/excluir
cultura embutida; `get_queryset` retorna união correta (embutidas +
próprias) e nunca devolve cultura de outra conta; criação grava fases
aninhadas corretamente; edição com `fases` no payload substitui a lista
inteira (fases antigas somem, novas aparecem); exclusão de cultura própria
em uso por plantio continua 409 (teste já existente,
`test_deletar_cultura_em_uso_por_plantio_e_protegido`, deve continuar
passando sem alteração).

**Frontend**: `CulturaForm` valida campos e fases antes de enviar;
adicionar/remover linha de fase funciona; `CulturasPage` mostra cards
embutidos sem ações e cards próprios com ações; fluxo de edição
pré-popula fases corretamente; fluxo de exclusão exibe erro 409 no
diálogo sem fechá-lo (mesmo padrão já testado em `FinanceiroPage.test.tsx`
para lançamentos).

## Fora de escopo

- Herdar ciclo/fases de uma "cultura-base" para variedades relacionadas —
  decisão explícita do brainstorm: cada variedade é independente, sem
  relação estrutural com outras culturas do mesmo tipo (ex.: nenhum
  vínculo entre "Tomate" embutido e "Tomate Cereja" próprio).
- Editar ou "esconder" uma cultura embutida por conta — as 3 embutidas
  permanecem fixas e iguais para todo mundo; se o usuário não gosta do
  ciclo padrão de "Tomate", a alternativa é cadastrar a própria variedade
  com o ciclo que preferir.
- Compartilhar uma cultura própria entre contas (ex.: "publicar" uma
  variedade cadastrada para outras contas usarem) — cada conta cadastra e
  usa só as próprias.
- Qualquer mudança em `Plantio.cultura` ou nos cálculos de
  `domain/cycle_calc.py` — o formato de `fases` consumido por
  `fase_atual()` não muda, só passa a aceitar dados criados pelo usuário
  além do seed fixo.
