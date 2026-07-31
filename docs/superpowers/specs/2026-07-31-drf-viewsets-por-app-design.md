# Serializers/Views/Permissions DRF por App — Design

## Contexto e motivação

Task #5 entregou o mecanismo de autenticação (JWT) e o mixin
`UsuarioScopedQuerySetMixin`, mas nenhuma rota de domínio existe ainda — só
models e o próprio fluxo de auth. Esta spec cobre a Task #6: expor cada
entidade de domínio (Propriedade, Talhao, Cultura, Plantio, Insumo,
AplicacaoInsumo, Tarefa, Colheita, LancamentoFinanceiro, Trabalhador, Diaria)
como uma API REST autenticada e isolada por usuário, usando o mixin já
construído.

## Decisões já validadas com o usuário

- Sem paginação (RNF01: volume baixíssimo no MVP).
- Sem framework de filtro por query string (`django-filter`) — o frontend
  filtra client-side por enquanto; pode virar uma task futura sem quebrar
  nada do que é construído aqui.
- `Cultura`/`FaseCultura` é somente leitura via API (`ReadOnlyModelViewSet`),
  sem isolamento por usuário — é catálogo compartilhado (exceção já prevista
  na ADR 002), gerenciado via Django admin (ADR 004: "admin pronto para
  cadastro rápido de culturas/insumos"). `FaseCultura` não vira endpoint
  próprio — vem aninhada dentro da resposta de `Cultura`.
- Nomes de rota (via `DefaultRouter`, registradas em `core/urls.py`):
  `/api/propriedades/`, `/api/talhoes/`, `/api/culturas/` (RO),
  `/api/plantios/`, `/api/insumos/`, `/api/aplicacoes-insumo/`,
  `/api/tarefas/`, `/api/colheitas/`, `/api/lancamentos-financeiros/`,
  `/api/trabalhadores/`, `/api/diarias/`.

## Arquitetura

Cada app ganha `serializers.py` + `views.py` — DRF `ModelViewSet` (CRUD
completo) por model, exceto `Cultura` (`ReadOnlyModelViewSet`). Todo
viewset com dono (direto ou indireto) herda `core.permissions.
UsuarioScopedQuerySetMixin` (Task #5) com o `usuario_lookup` correto pra
aquele model. `core/urls.py` ganha um `DefaultRouter` único, e cada task
registra suas próprias rotas nele (arquivo compartilhado, editado
incrementalmente — mesmo padrão já usado em `finance/models.py` nas tasks
anteriores).

### Mapeamento de `usuario_lookup` por model

| Model | `usuario_lookup` |
|---|---|
| `Propriedade` | `"usuario"` (direto) |
| `Talhao` | `"propriedade__usuario"` |
| `Plantio` | `"talhao__propriedade__usuario"` |
| `Insumo` | `"usuario"` (direto) |
| `AplicacaoInsumo` | `"plantio__talhao__propriedade__usuario"` |
| `Tarefa` | `"plantio__talhao__propriedade__usuario"` |
| `Colheita` | `"plantio__talhao__propriedade__usuario"` |
| `LancamentoFinanceiro` | `"plantio__talhao__propriedade__usuario"` |
| `Trabalhador` | `"usuario"` (direto) |
| `Diaria` | `"plantio__talhao__propriedade__usuario"` (ver nota abaixo sobre o segundo FK) |
| `Cultura`/`FaseCultura` | nenhum — catálogo compartilhado, sem filtro |

### Fechando o buraco de escrita do mixin (o ponto mais importante desta spec)

`UsuarioScopedQuerySetMixin` só protege leitura (`get_queryset()`). Pra
escrita, todo serializer que tem um campo de FK apontando pra um objeto
"pai" (ex.: `Talhao.propriedade`, `Plantio.talhao`, `AplicacaoInsumo.plantio`
e `.insumo`, `Diaria.plantio` e `.trabalhador`) restringe o `queryset`
daquele campo, no `__init__` do serializer, aos objetos que já pertencem a
`request.user`:

```python
class TalhaoSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["propriedade"].queryset = Propriedade.objects.filter(usuario=request.user)

    class Meta:
        model = Talhao
        fields = ["id", "propriedade", "nome", "area", "tipo_solo"]
```

Efeito: tentar criar/atualizar um `Talhao` apontando pro `propriedade_id` de
outro usuário falha sozinho com `400` ("objeto não existe" — comportamento
padrão do `PrimaryKeyRelatedField` do DRF quando o valor não está no
`queryset` do campo), sem revelar que aquele ID pertence a outra pessoa
— mesma propriedade de não-vazamento que o `404` do mixin dá pra leitura.

Para `Diaria` (duas FKs: `trabalhador` e `plantio`) e `AplicacaoInsumo`
(duas FKs: `insumo` e `plantio`), os dois campos são escopados
independentemente dessa mesma forma. Isso já garante que as duas FKs
concordam entre si — se ambas só aceitam objetos de `request.user`, elas
não podem apontar pra usuários diferentes.

Para models com `usuario` direto (`Propriedade`, `Insumo`, `Trabalhador`),
o campo `usuario` **não aparece nos `fields` do serializer** — é
preenchido em `perform_create` do viewset:

```python
class PropriedadeViewSet(viewsets.ModelViewSet):
    queryset = Propriedade.objects.all()
    serializer_class = PropriedadeSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
```

(Modelos sem dono direto — `Talhao`, `Plantio`, etc. — não precisam de
`perform_create` customizado; o dono já vem transitivamente do FK pai que o
serializer já validou.)

### Ação especial: pagar diárias pendentes

`finance/services.py::pagar_diarias_pendentes` (já implementado na branch
`trabalhadores-diarias`) vira uma `@action` no `TrabalhadorViewSet`:

```python
class TrabalhadorViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    ...
    usuario_lookup = "usuario"

    @action(detail=True, methods=["post"], url_path="pagar-diarias")
    def pagar_diarias(self, request, pk=None):
        trabalhador = self.get_object()
        lancamentos = pagar_diarias_pendentes(trabalhador)
        serializer = LancamentoFinanceiroSerializer(lancamentos, many=True)
        return Response(serializer.data)
```

`self.get_object()` já passa pelo `get_queryset()` do mixin — só um
`trabalhador` do próprio usuário pode ser alvo dessa ação (404 se for de
outro usuário, mesma garantia de sempre).

## Componentes por app

### `properties` — `Propriedade`, `Talhao`

- `PropriedadeViewSet`: `usuario_lookup = "usuario"`, `usuario` não é campo
  do serializer, preenchido em `perform_create`.
- `TalhaoViewSet`: `usuario_lookup = "propriedade__usuario"`,
  `propriedade` escopado no `__init__` do serializer.

### `crops` — `Cultura` (somente leitura)

- `CulturaViewSet(viewsets.ReadOnlyModelViewSet)`: sem mixin de tenant, sem
  `usuario_lookup`, `queryset = Cultura.objects.all()`.
- `CulturaSerializer` inclui um campo aninhado `fases` (somente leitura,
  `FaseCulturaSerializer(many=True)`), usando o `related_name` já existente
  em `FaseCultura.cultura`.

### `plantings` — `Plantio`

- `PlantioViewSet`: `usuario_lookup = "talhao__propriedade__usuario"`,
  `talhao` e `cultura` escopados no `__init__` (`talhao` por usuário; `cultura`
  não precisa de escopo por usuário — é catálogo compartilhado, qualquer
  cultura cadastrada é válida pra qualquer usuário).

### `inputs` — `Insumo`, `AplicacaoInsumo`

- `InsumoViewSet`: `usuario_lookup = "usuario"`, mesmo padrão de
  `Propriedade`.
- `AplicacaoInsumoViewSet`: `usuario_lookup = "plantio__talhao__propriedade__usuario"`,
  `plantio` e `insumo` escopados no `__init__`. `created_by` não é campo do
  serializer — preenchido em `perform_create` a partir de `request.user`
  (mesma trilha de auditoria da ADR 007).

### `tasks` — `Tarefa`

- `TarefaViewSet`: `usuario_lookup = "plantio__talhao__propriedade__usuario"`,
  `plantio` escopado no `__init__`.

### `harvest` — `Colheita`

- `ColheitaViewSet`: `usuario_lookup = "plantio__talhao__propriedade__usuario"`,
  `plantio` escopado no `__init__`.

### `finance` — `LancamentoFinanceiro`, `Trabalhador`, `Diaria`

- `LancamentoFinanceiroViewSet`: `usuario_lookup = "plantio__talhao__propriedade__usuario"`,
  `plantio` escopado no `__init__`.
- `TrabalhadorViewSet`: `usuario_lookup = "usuario"`, mesmo padrão de
  `Propriedade`/`Insumo`, mais a action `pagar-diarias` descrita acima.
- `DiariaViewSet`: `usuario_lookup = "plantio__talhao__propriedade__usuario"`,
  `trabalhador` e `plantio` escopados independentemente no `__init__`
  (fecha a lacuna de consistência cross-tenant já anotada no post-plan note
  do plano `2026-07-31-trabalhadores-diarias.md`).

## Fluxo de dados (exemplo: criar um Talhão)

```
POST /api/talhoes/ {"propriedade": 7, "nome": "Talhao Novo", "area": "2.5", "tipo_solo": "argiloso"}
Authorization: Bearer <access>

    → TalhaoSerializer.__init__ restringe o campo "propriedade" a
      Propriedade.objects.filter(usuario=request.user)
    → se propriedade=7 não pertence a request.user: 400 "Invalid pk 7"
    → se pertence: Talhao criado normalmente, sem perform_create especial
      (o dono vem transitivamente da propriedade validada)
```

## Tratamento de erros / casos de borda

- Criar/atualizar um objeto referenciando o FK de outro usuário: `400`
  (campo com "objeto não existe" — não revela que o ID pertence a outra
  conta).
- Ler/editar/deletar um objeto de outro usuário via URL (`/talhoes/42/`):
  `404` (via `UsuarioScopedQuerySetMixin.get_queryset()`, já construído na
  Task #5).
- `pagar-diarias` chamado num `trabalhador` de outro usuário: `404` (mesma
  razão acima — `get_object()` passa pelo `get_queryset()` do mixin).
- Requisição sem token de autenticação em qualquer endpoint desta spec:
  `401` (padrão global já configurado na Task #5).

## Testes previstos

Um arquivo de teste por app (`lagoagro/tests/test_<app>_views.py`), usando
`rest_framework.test.APIClient` com autenticação real via JWT (não
`force_authenticate` — a spec de auth já provou o mixin isoladamente na
Task #5; aqui o objetivo é provar que CADA viewset compõe corretamente
serializer + mixin + roteamento). Padrão mínimo por app:

- Criar um objeto válido (FK pertence ao usuário autenticado) → `201`,
  dados corretos.
- Criar um objeto com FK de outro usuário → `400`.
- Listar → só retorna objetos do usuário autenticado.
- Tentar acessar (`GET`/`PATCH`/`DELETE`) um objeto de outro usuário por ID
  → `404`.
- Requisição sem token → `401`.

Para `Cultura`: só testes de leitura (list/retrieve incluem `fases`
aninhadas), sem teste de escrita (não existe endpoint de escrita) e sem
teste de isolamento por usuário (não é escopado).

Para `TrabalhadorViewSet.pagar_diarias`: teste de ponta a ponta via HTTP
(criar trabalhador + diárias pendentes, chamar a action, conferir que
retorna os `LancamentoFinanceiro` criados) e teste de que chamar a action
num `trabalhador` de outro usuário retorna `404`.

## Fora de escopo (nesta spec)

- Paginação e filtro por query string (decisão já registrada acima).
- Qualquer coisa do frontend (Task #8) — esta spec só entrega a API.
- Rate limiting (Task #9, deploy).
- Mudar qualquer `usuario_lookup`/modelo já existente — esta spec só
  adiciona a camada de serializers/views por cima do que já existe.
