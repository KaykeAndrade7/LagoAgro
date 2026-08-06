# ADR 010 — Cultura deixa de ser exceção multi-tenant: cadastro de variedade por conta

## Status
Aceito

## Contexto

ADR 002 estabeleceu que toda tabela de domínio teria `usuario_id` (direto ou
via `propriedade_id`) desde o primeiro schema, para evitar retrabalho e IDOR
quando o sistema virasse multiusuário. `Cultura` (Tomate/Pimentão/Batata,
com suas `FaseCultura`) foi, na prática, construída como uma exceção
implícita a essa regra: um catálogo global, semeado por `seed_culturas`,
sem `usuario_id`, somente leitura para todas as contas via API.

Feedback do usuário final (2026-08-06): o catálogo fixo de 3 culturas não
cobre a realidade dele — ele planta variedades específicas (ex.: "Tomate
Cereja") com ciclo e fases diferentes das culturas embutidas, e quer poder
cadastrar as próprias variedades sem depender de alteração de código ou de
acesso ao Django admin.

## Decisão

`Cultura.usuario` passa a ser um `ForeignKey` nullable para o usuário:

- `usuario=None` → cultura embutida (catálogo do MVP, semeada por
  `seed_culturas`), visível e listável por qualquer conta autenticada,
  nunca editável nem excluível pela API (`CulturaViewSet.get_object`
  levanta `PermissionDenied` para `update`/`partial_update`/`destroy`
  quando `usuario_id is None`).
- `usuario=<conta>` → variedade cadastrada pela própria conta, com CRUD
  completo, visível apenas a ela. `CulturaViewSet.get_queryset` retorna a
  união (`Q(usuario__isnull=True) | Q(usuario=request.user)`), nunca
  expondo cultura de outra conta.
- Unicidade de nome deixa de ser global e passa a ser por conta
  (`UniqueConstraint(fields=["usuario", "nome"])`), com validação adicional
  em `CulturaSerializer.validate_nome` para impedir colisão de nome
  (case-insensitive) entre a lista embutida e a própria conta — evitando
  duas entradas com o mesmo nome no dropdown de plantio.

Isso reverte, para `Cultura` especificamente, a caracterização de "exceção"
descrita implicitamente pela ADR 002: `Cultura` agora segue a mesma regra de
isolamento por `usuario_id` que as demais tabelas de domínio.

**Consequência direta identificada nesta revisão:** como `Cultura` passou a
ser dado potencialmente privado por conta, qualquer serializer que aceite um
ID de `Cultura` vindo do cliente precisa escopar o queryset desse campo por
usuário autenticado — do contrário uma conta pode referenciar a `Cultura`
própria de outra conta por ID (IDOR de escrita). `PlantioSerializer` fazia
isso para `talhao` mas não fazia para `cultura`; foi corrigido nesta mesma
leva de mudanças para escopar `self.fields["cultura"].queryset` à união de
culturas embutidas + próprias da conta autenticada, no mesmo padrão já usado
por `AplicacaoInsumoSerializer` em `inputs/serializers.py`.

## Consequências

- Positivo: o usuário final pode cadastrar, editar e excluir suas próprias
  variedades de cultura pela UI, com ciclo e fases customizados, sem
  depender do catálogo fixo do MVP nem do Django admin.
- Positivo: o catálogo embutido continua protegido (somente leitura para
  todas as contas), preservando a base de referência do MVP.
- Positivo: `seed_culturas` foi ajustado para procurar/criar sempre com
  `usuario=None` no `get_or_create`, evitando colidir com uma cultura
  própria de alguma conta com o mesmo nome (o que antes podia levantar
  `MultipleObjectsReturned` ou semear em cima do registro errado).
- Custo: todo novo endpoint que referenciar `Cultura` por ID vindo do
  cliente precisa lembrar de escopar o queryset do campo por usuário — isso
  deixou de ser automaticamente seguro por padrão só porque `Cultura` é
  "catálogo". `PlantioSerializer` foi corrigido nesta revisão; qualquer novo
  serializer que ganhe um campo `Cultura` no futuro deve seguir o mesmo
  padrão.
