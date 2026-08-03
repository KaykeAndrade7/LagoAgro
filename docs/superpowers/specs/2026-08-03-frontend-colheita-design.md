# Design — Frontend: colheita (Task #8, fatia 4a/5)

## Contexto

A fatia 3/5 (insumos+aplicações, tarefas+dashboard RF12, fluxo de push)
está inteira mergeada. A fatia 4 original ("colheita + financeiro") foi
decomposta em duas sub-fatias independentes, mesmo racional da fatia 3:
**4a) Colheita (este documento)** e **4b) Financeiro (trabalhadores,
diárias, lançamentos)**.

Backend de `Colheita` (RF09) já existe: `harvest.Colheita` (model,
serializer, `ModelViewSet` completo). O que falta é só o frontend — mais
uma peça nova: **RF07 (data segura de colheita), adiada duas vezes
(fatias 3a e 3b), entra agora** — decisão do usuário (2026-08-03): a
página de Colheita é onde esse cálculo faz mais sentido, e a função pura
já existe e já tem testes (`domain/safety_calc.py`).

## Contrato real do backend (confirmado lendo `lagoagro/harvest/`)

- `GET/POST/PATCH/DELETE /api/colheitas/` — CRUD completo
  (`ColheitaViewSet(UsuarioScopedQuerySetMixin, ModelViewSet)`,
  `usuario_lookup="plantio__talhao__propriedade__usuario"`).
  `ColheitaSerializer`: `{id, plantio, data, classificacao, quantidade}`.
  `classificacao` é `"primeira" | "segunda"`. `quantidade` é
  `DecimalField` — chega como **string** (mesmo padrão de `Talhao.area`,
  `AplicacaoInsumo.quantidade`).
- `Colheita.plantio` é `on_delete=CASCADE` (não `PROTECT`) — não é trilha
  de auditoria como `AplicacaoInsumo`/`LancamentoFinanceiro`. **Colheita
  aceita edição e exclusão sem restrição**, diferente do padrão
  "sem editar" da fatia 3a.
- `domain/safety_calc.py:data_segura_colheita(aplicacoes)` é uma função
  Python pura (já testada): recebe uma lista de `{"data": date,
  "carencia_dias": int}` e devolve a maior `data + carencia_dias` entre
  todas, ou `None` se a lista for vazia. **Nenhum endpoint expõe isso
  hoje** — é o que esta fatia adiciona.

## Decisões de abordagem

**Endpoint novo: `GET /api/plantios/{id}/data-segura-colheita/`.** Uma
`@action` no `PlantioViewSet` já existente (mesmo padrão de
`pagar-diarias` em `TrabalhadorViewSet`), já escopada por usuário porque
herda de `UsuarioScopedQuerySetMixin`. Busca
`AplicacaoInsumo.objects.filter(plantio=plantio).select_related("insumo")`,
monta a lista de dicts que `data_segura_colheita` espera, e retorna
`{"data_segura": "YYYY-MM-DD"}` ou `{"data_segura": null}`. Nenhuma
mudança em `domain/safety_calc.py` (função pura, já testada,
reaproveitada tal como está).

**`ColheitaForm` busca a data segura sob demanda, ao selecionar um
plantio — não é pré-carregada pela página.** Diferente de todo formulário
anterior (que só recebe props já resolvidas pela página dona), este é o
primeiro caso em que o próprio formulário precisa de um dado que depende
do valor de um campo em tempo real (o plantio selecionado). Usa
`useQuery(['data-segura', plantioSelecionado], ...)` diretamente dentro
do `ColheitaForm`, habilitada só quando `plantioSelecionado > 0` — exceção
deliberada e documentada ao padrão "só a página tem `useQuery`", porque o
dado é intrinsecamente amarrado ao valor de um campo do formulário, não a
algo que a página possa pré-computar barato para todos os plantios.
Mostra como texto informativo, **nunca bloqueia o submit** — RF07 é só
cálculo/exibição, nunca chegou a virar RF06-style "cálculo automático que
o usuário rejeitou"; é puramente informativo, igual à decisão original
sobre não haver alerta automático de fase.

**`Colheita` com CRUD completo (criar/editar/excluir), sem pré-checagem
de exclusão.** Não é referenciada por nenhuma outra entidade — decisão
simples, mesmo padrão de `PlantioForm`/`TarefaForm`.

**Mesma stack e convenções das fatias anteriores**: react-hook-form + zod,
TanStack Query, `ConfirmDialog`, sem hooks customizados por entidade
(a exceção documentada acima é `useQuery` direto num formulário, não um
hook novo), `npx tsc -b` obrigatório em toda revisão de task.

## Estrutura de arquivos

```
lagoagro/
└── plantings/
    └── views.py            — MODIFICADO: + @action data-segura-colheita em PlantioViewSet

frontend/src/
├── api/
│   ├── colheitas.ts         — tipo Colheita + listarColheitas/criarColheita/atualizarColheita/excluirColheita
│   └── plantios.ts          — MODIFICADO: + obterDataSeguraColheita(plantioId)
├── components/
│   └── ColheitaForm.tsx     — criar/editar, busca data segura ao selecionar plantio
├── pages/
│   └── ColheitasPage.tsx    — lista + criar/editar/excluir
├── layout/
│   └── AppShell.tsx         — MODIFICADO: + link de nav pra /colheitas
└── routes.tsx               — MODIFICADO: + rota protegida /colheitas
```

## Backend: `@action` de data segura

```python
from django.utils.dateformat import format as date_format
from domain.safety_calc import data_segura_colheita
from inputs.models import AplicacaoInsumo

class PlantioViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    ...
    @action(detail=True, methods=["get"], url_path="data-segura-colheita")
    def data_segura_colheita_view(self, request, pk=None):
        plantio = self.get_object()
        aplicacoes = [
            {"data": a.data, "carencia_dias": a.insumo.carencia_dias}
            for a in AplicacaoInsumo.objects.filter(plantio=plantio).select_related("insumo")
        ]
        data_segura = data_segura_colheita(aplicacoes)
        return Response({"data_segura": data_segura.isoformat() if data_segura else None})
```
(exato código completo, com imports certos, vai pro plano — isso é só o
esqueleto da decisão). Escopado por usuário automaticamente:
`self.get_object()` já usa o queryset filtrado pelo mixin, então um
`pk` de plantio de outro usuário retorna 404 antes de chegar na lógica.

## Frontend: `ColheitasPage`

`useQuery(['colheitas'])`, mais `useQuery(['plantios'])`/`['talhoes']`/
`['culturas']` (reaproveitando cache, mesmo padrão de reconstrução de
label `labelPlantio` já usado em `TarefasPage`/`AplicacoesPage`). Lista
mostra label do plantio, data formatada, classificação (rótulo em
português), quantidade. Ações inline de editar/excluir. Botão
"+ Colheita" abre `ColheitaForm`.

`ColheitaForm`: campos `plantio` (select), `data` (date), `classificacao`
(select "Primeira"/"Segunda"), `quantidade` (texto,
`.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, ...)`,
mesmo padrão de `Talhao.area`/`AplicacaoInsumo.quantidade`). Ao
selecionar um plantio, dispara `useQuery(['data-segura', plantioId])` e
mostra "Data segura para colher: DD/MM/AAAA" ou "Nenhuma restrição de
carência para este plantio." (quando `data_segura` é `null`) acima dos
botões — texto informativo, não bloqueia o submit em nenhum caso.
Mapeamento de erro de mutação via `useMapeamentoErroFormulario` (hook
compartilhado desde a fatia 3b).

## Erros e loading

Mesmo padrão das fatias anteriores: "Carregando..." por página, mensagem
+ "Tentar novamente" (refetch de todas as queries da página, lição da
revisão final da 3b) em erro de fetch, erro de mutação via
`useMapeamentoErroFormulario`. A busca de "data segura" dentro do
formulário, se falhar, simplesmente não mostra o texto informativo (não é
crítico o suficiente pra bloquear o formulário com uma tela de erro) —
falha silenciosa aceitável aqui porque é dado auxiliar, não a
funcionalidade principal do formulário.

## Testes

- **Backend**: teste da nova `@action` — retorna a maior data
  segura entre várias aplicações, retorna `null` sem aplicações, 404 pra
  plantio de outro usuário.
- **`api/colheitas.ts`**: um teste por função.
- **`api/plantios.ts`**: um teste novo pra `obterDataSeguraColheita`.
- **`ColheitaForm`**: validação de campos; busca e exibe a data segura ao
  selecionar um plantio; mostra "sem restrição" quando `data_segura` é
  `null`; erro de mutação mapeado.
- **`ColheitasPage`**: lista carrega; criar/editar/excluir refletem na
  lista.
- **`routes.tsx`**: 1 teste novo pra `/colheitas`.

## Fora de escopo (fatias seguintes)

- Trabalhadores, diárias, lançamentos financeiros — fatia 4b.
- RF06 (dias restantes de ciclo) — ainda sem sinal de necessidade real.
- Bloquear submit de colheita antes da data segura — puramente
  informativo por decisão de produto já validada (sem enforcement
  automático).
- Ícones reais, prompt de instalação — fatia 5.
