# Cadastro de Cultura por Conta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each account register its own crop varieties (`Cultura`) with
their own cycle/phases, while the 3 built-in ones (Tomate, Pimentão,
Batata) stay shared and read-only for everyone.

**Architecture:** `Cultura` gains a nullable `usuario` FK (`null` = built-in
catalog, set = account-owned). `CulturaViewSet` goes from
`ReadOnlyModelViewSet` to a full `ModelViewSet` whose queryset unions
built-in + own rows, blocks writes to built-in rows with 403, and whose
serializer does a writable nested `fases` list (full-replace on update).
Frontend gets a `CulturaForm` with a dynamic phase list
(`useFieldArray`), wired into `CulturasPage` the same way
`InsumoForm`/`InsumosPage` already work.

**Tech Stack:** Django REST Framework (`ModelViewSet`, nested writable
serializer), React + react-hook-form (`useFieldArray`) + zod, TanStack
Query, Vitest + React Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-06-cultura-cadastro-por-conta-design.md`
  — read it if anything below is ambiguous, it governs.
- Each variety has its own `ciclo_dias`/`fases` — no inheritance from a
  "base" cultura (out of scope, decided in brainstorm).
- Built-in culturas (`usuario is None`) are never editable/deletable by
  any account, only listable.
- `Plantio.cultura` stays `PROTECT` — unchanged by this plan.
- Name uniqueness is per-account visibility scope (built-in + own),
  case-insensitive, enforced in the serializer (readable error) backed by
  a DB `UniqueConstraint` (last line of defense).
- Follow existing patterns exactly: `finance/views.py` `TrabalhadorViewSet`
  for `perform_create` style, `components/InsumoForm.tsx` +
  `pages/InsumosPage.tsx` for the create/edit/delete UI pattern.
- Commit convention: Conventional Commits, scope `crops` for backend
  tasks, `frontend` for frontend tasks (see root `CLAUDE.md`).

---

### Task 1: Cultura model — usuario scoping

**Files:**
- Modify: `lagoagro/crops/models.py`
- Create: `lagoagro/crops/migrations/0002_cultura_usuario_and_more.py`
- Modify: `lagoagro/tests/test_crops_models.py`

**Interfaces:**
- Produces: `Cultura.usuario` — nullable `ForeignKey` to
  `settings.AUTH_USER_MODEL`, `related_name="culturas"`,
  `on_delete=models.CASCADE`. DB constraint
  `unique_cultura_por_usuario` on `("usuario", "nome")`. `Cultura.nome` is
  no longer globally `unique=True`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `lagoagro/tests/test_crops_models.py` with:

```python
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from crops.models import Cultura, FaseCultura

pytestmark = pytest.mark.django_db


def test_cultura_pode_ser_embutida_ou_de_uma_conta():
    # usuario nulo = catalogo embutido (pimentao, tomate, batata no MVP,
    # ver seed_culturas); usuario preenchido = variedade cadastrada pela
    # propria conta (ADR: ver spec 2026-08-06-cultura-cadastro-por-conta).
    embutida = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    usuario = get_user_model().objects.create_user(username="produtor1", password="senha123")
    propria = Cultura.objects.create(usuario=usuario, nome="Tomate Cereja", ciclo_dias=70)

    assert embutida.usuario is None
    assert propria.usuario == usuario
    assert str(embutida) == "Pimentao"


def test_duas_contas_podem_ter_cultura_propria_com_mesmo_nome():
    User = get_user_model()
    usuario1 = User.objects.create_user(username="produtor1", password="senha123")
    usuario2 = User.objects.create_user(username="produtor2", password="senha123")

    Cultura.objects.create(usuario=usuario1, nome="Tomate Cereja", ciclo_dias=70)
    Cultura.objects.create(usuario=usuario2, nome="Tomate Cereja", ciclo_dias=65)

    assert Cultura.objects.filter(nome="Tomate Cereja").count() == 2


def test_mesma_conta_nao_pode_repetir_nome_de_cultura():
    usuario = get_user_model().objects.create_user(username="produtor1", password="senha123")
    Cultura.objects.create(usuario=usuario, nome="Tomate Cereja", ciclo_dias=70)

    with pytest.raises(IntegrityError):
        Cultura.objects.create(usuario=usuario, nome="Tomate Cereja", ciclo_dias=65)


def test_fase_cultura_pertence_a_uma_cultura_com_intervalo_de_dias():
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    fase = FaseCultura.objects.create(cultura=cultura, nome="muda", dia_inicio=0, dia_fim=20)

    assert fase.cultura == cultura
    assert fase.dia_inicio == 0
    assert fase.dia_fim == 20


def test_fases_sao_ordenadas_por_dia_inicio():
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=cultura, nome="floracao", dia_inicio=21, dia_fim=45)
    FaseCultura.objects.create(cultura=cultura, nome="muda", dia_inicio=0, dia_fim=20)

    nomes = list(cultura.fases.values_list("nome", flat=True))

    assert nomes == ["muda", "floracao"]
```

This **replaces** `test_cultura_e_catalogo_compartilhado_sem_usuario`
(asserted `not hasattr(cultura, "usuario")`, which is now false by
design) with `test_cultura_pode_ser_embutida_ou_de_uma_conta`, and adds
the two new uniqueness tests. The two `FaseCultura` tests are unchanged
from the current file (still correct, not touched).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd lagoagro && uv run pytest tests/test_crops_models.py -v`
Expected: `test_cultura_pode_ser_embutida_ou_de_uma_conta`,
`test_duas_contas_podem_ter_cultura_propria_com_mesmo_nome`, and
`test_mesma_conta_nao_pode_repetir_nome_de_cultura` FAIL (no `usuario`
field/constraint exists yet — `AttributeError` or the constraint simply
not raising `IntegrityError`).

- [ ] **Step 3: Add `usuario` field and constraint to the model**

Replace the full contents of `lagoagro/crops/models.py` with:

```python
from django.conf import settings
from django.db import models


class Cultura(models.Model):
    # usuario nulo = catalogo embutido (pimentao, tomate, batata no MVP,
    # populado por seed_culturas), visivel e listavel por qualquer conta,
    # nunca editavel/excluivel pela API. usuario preenchido = variedade
    # cadastrada pela propria conta, visivel so a ela, com CRUD completo.
    # Ver docs/superpowers/specs/2026-08-06-cultura-cadastro-por-conta-design.md.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="culturas"
    )
    nome = models.CharField(max_length=100)
    ciclo_dias = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["usuario", "nome"], name="unique_cultura_por_usuario"),
        ]

    def __str__(self):
        return self.nome


class FaseCultura(models.Model):
    cultura = models.ForeignKey(Cultura, on_delete=models.CASCADE, related_name="fases")
    nome = models.CharField(max_length=100)
    dia_inicio = models.PositiveIntegerField()
    dia_fim = models.PositiveIntegerField()

    class Meta:
        ordering = ["dia_inicio"]

    def __str__(self):
        return f"{self.cultura.nome} - {self.nome}"
```

- [ ] **Step 4: Generate the migration**

Run: `cd lagoagro && uv run python manage.py makemigrations crops`

If this command is blocked or unavailable in your environment, hand-write
`lagoagro/crops/migrations/0002_cultura_usuario_and_more.py` with this
exact content instead:

```python
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('crops', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cultura',
            name='nome',
            field=models.CharField(max_length=100),
        ),
        migrations.AddField(
            model_name='cultura',
            name='usuario',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='culturas',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddConstraint(
            model_name='cultura',
            constraint=models.UniqueConstraint(fields=('usuario', 'nome'), name='unique_cultura_por_usuario'),
        ),
    ]
```

Either way, verify the model and migrations agree:

Run: `cd lagoagro && uv run python manage.py makemigrations --check --dry-run`
Expected: `No changes detected`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd lagoagro && uv run pytest tests/test_crops_models.py -v`
Expected: all 5 tests PASS.

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd lagoagro && uv run pytest -q`
Expected: all tests pass (existing `tests/test_crops_views.py` and
`tests/test_plantings_models.py` still create `Cultura` without a
`usuario` kwarg — that still works since the field is nullable with no
default requirement).

- [ ] **Step 7: Commit**

```bash
git add lagoagro/crops/models.py lagoagro/crops/migrations/0002_cultura_usuario_and_more.py lagoagro/tests/test_crops_models.py
git commit -m "feat(crops): adicionar usuario opcional a Cultura para variedades por conta"
```

---

### Task 2: CulturaViewSet + CulturaSerializer — CRUD com escopo por conta

**Files:**
- Modify: `lagoagro/crops/serializers.py`
- Modify: `lagoagro/crops/views.py`
- Modify: `lagoagro/tests/test_crops_views.py`

**Interfaces:**
- Consumes: `Cultura.usuario` (nullable FK, Task 1).
- Produces: `GET/POST /api/culturas/`, `PATCH`/`DELETE /api/culturas/{id}/`.
  Response shape: `{id, nome, ciclo_dias, fases: [{id, nome, dia_inicio,
  dia_fim}], somente_leitura: bool}`. Request shape for POST/PATCH:
  `{nome, ciclo_dias, fases: [{nome, dia_inicio, dia_fim}]}` (no `id` in
  `fases` — always full-replace on update). Error shapes: `400` with
  `{"nome": [...]}` or `{"fases": [...]}` for validation failures, `403`
  with `{"detail": "..."}` for editing/deleting a built-in cultura, `409`
  (unchanged, already existing mechanism) for deleting a cultura in use
  by a `Plantio`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `lagoagro/tests/test_crops_views.py` with:

```python
import pytest
from rest_framework.test import APIClient

from crops.models import Cultura, FaseCultura


def _payload_valido(nome="Tomate Cereja"):
    return {
        "nome": nome,
        "ciclo_dias": 70,
        "fases": [
            {"nome": "Muda", "dia_inicio": 0, "dia_fim": 15},
            {"nome": "Colheita", "dia_inicio": 15, "dia_fim": 70},
        ],
    }


def test_listar_culturas_inclui_fases_aninhadas(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=cultura, nome="Plantio", dia_inicio=0, dia_fim=10)
    FaseCultura.objects.create(cultura=cultura, nome="Floracao", dia_inicio=11, dia_fim=40)

    response = client.get("/api/culturas/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert len(response.data[0]["fases"]) == 2
    assert response.data[0]["fases"][0]["nome"] == "Plantio"
    assert response.data[0]["somente_leitura"] is True


def test_listar_culturas_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/culturas/")

    assert response.status_code == 401


def test_listar_culturas_retorna_embutidas_e_so_as_proprias_da_conta(criar_usuario_autenticado):
    usuario1, client1 = criar_usuario_autenticado("produtor1")
    _, client2 = criar_usuario_autenticado("produtor2")
    Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=Cultura.objects.get(nome="Pimentao"), nome="Muda", dia_inicio=0, dia_fim=10)
    propria1 = Cultura.objects.create(usuario=usuario1, nome="Tomate Cereja", ciclo_dias=70)
    FaseCultura.objects.create(cultura=propria1, nome="Muda", dia_inicio=0, dia_fim=15)

    response1 = client1.get("/api/culturas/")
    response2 = client2.get("/api/culturas/")

    nomes1 = {c["nome"] for c in response1.data}
    nomes2 = {c["nome"] for c in response2.data}
    assert nomes1 == {"Pimentao", "Tomate Cereja"}
    assert nomes2 == {"Pimentao"}


def test_criar_cultura_com_fases_aninhadas(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/culturas/", _payload_valido(), format="json")

    assert response.status_code == 201
    assert response.data["somente_leitura"] is False
    assert len(response.data["fases"]) == 2
    cultura = Cultura.objects.get(id=response.data["id"])
    assert cultura.usuario == usuario
    assert cultura.fases.count() == 2


def test_criar_cultura_sem_fases_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    payload = _payload_valido()
    payload["fases"] = []

    response = client.post("/api/culturas/", payload, format="json")

    assert response.status_code == 400
    assert "fases" in response.data


def test_criar_cultura_com_fase_dia_inicio_maior_que_dia_fim_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    payload = _payload_valido()
    payload["fases"] = [{"nome": "Muda", "dia_inicio": 20, "dia_fim": 10}]

    response = client.post("/api/culturas/", payload, format="json")

    assert response.status_code == 400
    assert "fases" in response.data


def test_criar_cultura_com_nome_igual_a_embutida_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    Cultura.objects.create(nome="Tomate", ciclo_dias=120)

    response = client.post("/api/culturas/", _payload_valido(nome="tomate"), format="json")

    assert response.status_code == 400
    assert "nome" in response.data


def test_criar_cultura_com_nome_repetido_na_mesma_conta_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    client.post("/api/culturas/", _payload_valido(), format="json")

    response = client.post("/api/culturas/", _payload_valido(), format="json")

    assert response.status_code == 400
    assert "nome" in response.data


def test_editar_cultura_propria_substitui_a_lista_de_fases(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    criada = client.post("/api/culturas/", _payload_valido(), format="json").data

    payload = _payload_valido()
    payload["fases"] = [{"nome": "Fase unica", "dia_inicio": 0, "dia_fim": 70}]
    response = client.patch(f"/api/culturas/{criada['id']}/", payload, format="json")

    assert response.status_code == 200
    assert len(response.data["fases"]) == 1
    assert response.data["fases"][0]["nome"] == "Fase unica"


def test_editar_cultura_embutida_retorna_403(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    embutida = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=embutida, nome="Muda", dia_inicio=0, dia_fim=10)

    response = client.patch(f"/api/culturas/{embutida.id}/", {"nome": "Pimentao Editado"}, format="json")

    assert response.status_code == 403


def test_excluir_cultura_embutida_retorna_403(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    embutida = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    response = client.delete(f"/api/culturas/{embutida.id}/")

    assert response.status_code == 403
    assert Cultura.objects.filter(id=embutida.id).exists()


def test_excluir_cultura_propria_sem_uso_funciona(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    criada = client.post("/api/culturas/", _payload_valido(), format="json").data

    response = client.delete(f"/api/culturas/{criada['id']}/")

    assert response.status_code == 204
    assert not Cultura.objects.filter(id=criada["id"]).exists()
```

Note: this file **replaces** the old
`test_criar_cultura_via_api_nao_e_permitido` (asserted `405`, no longer
true) with the tests above.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd lagoagro && uv run pytest tests/test_crops_views.py -v`
Expected: most new tests FAIL (`405` instead of `201`/`200`/`403`/`204`,
`somente_leitura` key missing, etc.) — `test_listar_culturas_sem_token_retorna_401`
still passes unchanged.

- [ ] **Step 3: Rewrite the serializer with nested writable `fases`**

Replace the full contents of `lagoagro/crops/serializers.py` with:

```python
from django.db.models import Q
from rest_framework import serializers

from .models import Cultura, FaseCultura


class FaseCulturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaseCultura
        fields = ["id", "nome", "dia_inicio", "dia_fim"]
        read_only_fields = ["id"]


class CulturaSerializer(serializers.ModelSerializer):
    fases = FaseCulturaSerializer(many=True)
    somente_leitura = serializers.SerializerMethodField()

    class Meta:
        model = Cultura
        fields = ["id", "nome", "ciclo_dias", "fases", "somente_leitura"]

    def get_somente_leitura(self, obj):
        return obj.usuario_id is None

    def validate_fases(self, fases):
        if not fases:
            raise serializers.ValidationError("Cadastre pelo menos uma fase.")
        for fase in fases:
            if fase["dia_inicio"] >= fase["dia_fim"]:
                raise serializers.ValidationError("Em cada fase, dia_inicio deve ser menor que dia_fim.")
        return fases

    def validate_nome(self, nome):
        # Nome nao pode colidir (sem diferenciar maiuscula/minuscula) com
        # nenhuma cultura visivel a esta conta - embutida ou propria -
        # senao o dropdown de plantio fica com duas entradas confusas com
        # o mesmo nome.
        request = self.context["request"]
        queryset = Cultura.objects.filter(Q(usuario__isnull=True) | Q(usuario=request.user)).filter(
            nome__iexact=nome
        )
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Já existe uma cultura com esse nome.")
        return nome

    def create(self, validated_data):
        fases_data = validated_data.pop("fases")
        cultura = Cultura.objects.create(**validated_data)
        FaseCultura.objects.bulk_create([FaseCultura(cultura=cultura, **fase) for fase in fases_data])
        return cultura

    def update(self, instance, validated_data):
        # Substituicao completa da lista de fases (nao merge item a item) -
        # mais simples e evita fase "orfa" quando o cliente reordena/remove.
        fases_data = validated_data.pop("fases", None)
        instance.nome = validated_data.get("nome", instance.nome)
        instance.ciclo_dias = validated_data.get("ciclo_dias", instance.ciclo_dias)
        instance.save()
        if fases_data is not None:
            instance.fases.all().delete()
            FaseCultura.objects.bulk_create([FaseCultura(cultura=instance, **fase) for fase in fases_data])
        return instance
```

- [ ] **Step 4: Rewrite the viewset**

Replace the full contents of `lagoagro/crops/views.py` with:

```python
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from .models import Cultura
from .serializers import CulturaSerializer


class CulturaViewSet(viewsets.ModelViewSet):
    serializer_class = CulturaSerializer

    def get_queryset(self):
        # Uniao: catalogo embutido (usuario nulo) + culturas da propria
        # conta. Nunca vaza cultura de outra conta.
        return Cultura.objects.filter(Q(usuario__isnull=True) | Q(usuario=self.request.user)).order_by("nome")

    def get_object(self):
        obj = super().get_object()
        if self.action in ("update", "partial_update", "destroy") and obj.usuario_id is None:
            raise PermissionDenied("Não é possível editar ou excluir uma cultura do catálogo padrão.")
        return obj

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd lagoagro && uv run pytest tests/test_crops_views.py -v`
Expected: all tests PASS.

- [ ] **Step 6: Run the full backend suite to check for regressions**

Run: `cd lagoagro && uv run pytest -q`
Expected: all tests pass. In particular check
`tests/test_plantings_models.py::test_deletar_cultura_em_uso_por_plantio_e_protegido`
still passes unchanged (model-level `PROTECT`, untouched by this task).

- [ ] **Step 7: Commit**

```bash
git add lagoagro/crops/serializers.py lagoagro/crops/views.py lagoagro/tests/test_crops_views.py
git commit -m "feat(crops): abrir CRUD de Cultura com escopo por conta e fases aninhadas"
```

---

### Task 3: Frontend — api/culturas.ts + CulturaForm

**Files:**
- Modify: `frontend/src/api/culturas.ts`
- Modify: `frontend/src/api/culturas.test.ts`
- Create: `frontend/src/components/CulturaForm.tsx`
- Create: `frontend/src/components/CulturaForm.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/culturas/`, `PATCH`/`DELETE /api/culturas/{id}/`
  (Task 2's contract).
- Produces: `Cultura` type (now with `somente_leitura: boolean`),
  `FaseCulturaInput` type (`{nome, dia_inicio, dia_fim}`, no `id`),
  `CulturaInput` type (`{nome, ciclo_dias, fases: FaseCulturaInput[]}`),
  functions `criarCultura(input): Promise<Cultura>`,
  `atualizarCultura(id, input): Promise<Cultura>`,
  `excluirCultura(id): Promise<void>`. Component `CulturaForm({ cultura?,
  erro?, onSubmit: (input: CulturaInput) => void, onCancel: () => void
  })`.

- [ ] **Step 1: Write the failing test for the API client**

Replace the full contents of `frontend/src/api/culturas.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { atualizarCultura, criarCultura, excluirCultura, listarCulturas } from './culturas'

describe('api/culturas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('listarCulturas faz GET /api/culturas/ e retorna as fases aninhadas', async () => {
    const cultura = {
      id: 1,
      nome: 'Tomate',
      ciclo_dias: 90,
      fases: [{ id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
      somente_leitura: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([cultura]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listarCulturas()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/')
    expect(options.method).toBe('GET')
    expect(result).toEqual([cultura])
  })

  it('criarCultura faz POST /api/culturas/ com o payload de fases', async () => {
    const cultura = {
      id: 2,
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [{ id: 5, nome: 'Muda', dia_inicio: 0, dia_fim: 15 }],
      somente_leitura: false,
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(cultura), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Tomate Cereja', ciclo_dias: 70, fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 15 }] }
    const result = await criarCultura(input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual(input)
    expect(result).toEqual(cultura)
  })

  it('atualizarCultura faz PATCH /api/culturas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 2 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const input = { nome: 'Tomate Cereja', ciclo_dias: 75, fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 15 }] }
    await atualizarCultura(2, input)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/2/')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual(input)
  })

  it('excluirCultura faz DELETE /api/culturas/:id/', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await excluirCultura(2)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/culturas/2/')
    expect(options.method).toBe('DELETE')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/api/culturas.test.ts`
Expected: FAIL — `criarCultura`/`atualizarCultura`/`excluirCultura` are
not exported yet, and the `Cultura` fixture's `somente_leitura` field
doesn't type-check against the current `Cultura` type.

- [ ] **Step 3: Implement the API client**

Replace the full contents of `frontend/src/api/culturas.ts` with:

```typescript
import { apiRequest } from '../lib/api-client'

export type FaseCultura = {
  id: number
  nome: string
  dia_inicio: number
  dia_fim: number
}

export type FaseCulturaInput = {
  nome: string
  dia_inicio: number
  dia_fim: number
}

export type Cultura = {
  id: number
  nome: string
  ciclo_dias: number
  fases: FaseCultura[]
  somente_leitura: boolean
}

export type CulturaInput = {
  nome: string
  ciclo_dias: number
  fases: FaseCulturaInput[]
}

export function listarCulturas(): Promise<Cultura[]> {
  return apiRequest<Cultura[]>('/culturas/')
}

export function criarCultura(input: CulturaInput): Promise<Cultura> {
  return apiRequest<Cultura>('/culturas/', { method: 'POST', body: input })
}

export function atualizarCultura(id: number, input: CulturaInput): Promise<Cultura> {
  return apiRequest<Cultura>(`/culturas/${id}/`, { method: 'PATCH', body: input })
}

export function excluirCultura(id: number): Promise<void> {
  return apiRequest<void>(`/culturas/${id}/`, { method: 'DELETE' })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/api/culturas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing tests for `CulturaForm`**

Create `frontend/src/components/CulturaForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CulturaForm } from './CulturaForm'
import { ApiError } from '../lib/api-client'

describe('CulturaForm', () => {
  it('chama onSubmit com nome, ciclo_dias e a fase padrao preenchidos como numero', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '0')
    await userEvent.type(screen.getByLabelText('Dia fim'), '20')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
    })
  })

  it('adicionar fase inclui uma segunda linha no payload', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '0')
    await userEvent.type(screen.getByLabelText('Dia fim'), '20')
    await userEvent.click(screen.getByText('Adicionar fase'))

    const nomesFase = screen.getAllByLabelText('Fase')
    const diasInicio = screen.getAllByLabelText('Dia início')
    const diasFim = screen.getAllByLabelText('Dia fim')
    await userEvent.type(nomesFase[1], 'Colheita')
    await userEvent.type(diasInicio[1], '20')
    await userEvent.type(diasFim[1], '70')
    await userEvent.click(screen.getByText('Salvar'))

    expect(onSubmit).toHaveBeenCalledWith({
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [
        { nome: 'Muda', dia_inicio: 0, dia_fim: 20 },
        { nome: 'Colheita', dia_inicio: 20, dia_fim: 70 },
      ],
    })
  })

  it('remover a unica fase e tentar salvar mostra erro e nao chama onSubmit', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByText('Remover'))
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('Cadastre pelo menos uma fase')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mostra erro quando dia_inicio nao e menor que dia_fim numa fase', async () => {
    const onSubmit = vi.fn()
    render(<CulturaForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '20')
    await userEvent.type(screen.getByLabelText('Dia fim'), '10')
    await userEvent.click(screen.getByText('Salvar'))

    expect(await screen.findByText('dia_inicio deve ser menor que dia_fim')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pre-popula nome, ciclo_dias e a lista de fases ao editar', () => {
    const cultura = {
      id: 1,
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [
        { id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 },
        { id: 2, nome: 'Colheita', dia_inicio: 20, dia_fim: 70 },
      ],
      somente_leitura: false,
    }
    render(<CulturaForm cultura={cultura} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Nome')).toHaveValue('Tomate Cereja')
    expect(screen.getByLabelText('Ciclo (dias)')).toHaveValue('70')
    const nomesFase = screen.getAllByLabelText('Fase')
    expect(nomesFase).toHaveLength(2)
    expect(nomesFase[0]).toHaveValue('Muda')
    expect(nomesFase[1]).toHaveValue('Colheita')
  })

  it('cancelar dispara onCancel', async () => {
    const onCancel = vi.fn()
    render(<CulturaForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText('Cancelar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('mapeia erro de campo nome do backend para o campo correspondente', async () => {
    const erro = new ApiError(400, 'Erro de validacao', { nome: ['Já existe uma cultura com esse nome.'] })
    render(<CulturaForm erro={erro} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByText('Já existe uma cultura com esse nome.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/CulturaForm.test.tsx`
Expected: FAIL — `./CulturaForm` doesn't exist yet.

- [ ] **Step 7: Implement `CulturaForm`**

Create `frontend/src/components/CulturaForm.tsx`:

```tsx
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Cultura, CulturaInput } from '../api/culturas'
import type { ApiError } from '../lib/api-client'
import { useMapeamentoErroFormulario } from '../lib/mutation-errors'
import { Button, Field, FieldLabel, FormError, IconPlus, IconTrash, Input } from './ui'

const numeroInteiroNaoNegativo = z
  .string()
  .min(1, 'Obrigatório')
  .refine((v) => !Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0, 'Deve ser um número inteiro maior ou igual a zero')

const faseSchema = z
  .object({
    nome: z.string().min(1, 'Nome da fase é obrigatório'),
    dia_inicio: numeroInteiroNaoNegativo,
    dia_fim: numeroInteiroNaoNegativo,
  })
  .refine((fase) => Number(fase.dia_inicio) < Number(fase.dia_fim), {
    message: 'dia_inicio deve ser menor que dia_fim',
    path: ['dia_fim'],
  })

const schema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  ciclo_dias: z
    .string()
    .min(1, 'Ciclo é obrigatório')
    .refine((v) => !Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) > 0, 'Ciclo deve ser um número inteiro maior que zero'),
  fases: z.array(faseSchema).min(1, 'Cadastre pelo menos uma fase'),
})

type CulturaFormValues = z.infer<typeof schema>

const CAMPOS_CONHECIDOS = ['nome', 'ciclo_dias', 'fases'] as const

type CulturaFormProps = {
  cultura?: Cultura
  erro?: ApiError | null
  onSubmit: (input: CulturaInput) => void
  onCancel: () => void
}

export function CulturaForm({ cultura, erro, onSubmit, onCancel }: CulturaFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CulturaFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: cultura?.nome ?? '',
      ciclo_dias: cultura ? String(cultura.ciclo_dias) : '',
      fases: cultura
        ? cultura.fases.map((fase) => ({
            nome: fase.nome,
            dia_inicio: String(fase.dia_inicio),
            dia_fim: String(fase.dia_fim),
          }))
        : [{ nome: '', dia_inicio: '', dia_fim: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'fases' })

  useMapeamentoErroFormulario(erro, setError, CAMPOS_CONHECIDOS)

  function aoSubmeter(values: CulturaFormValues) {
    onSubmit({
      nome: values.nome,
      ciclo_dias: Number(values.ciclo_dias),
      fases: values.fases.map((fase) => ({
        nome: fase.nome,
        dia_inicio: Number(fase.dia_inicio),
        dia_fim: Number(fase.dia_fim),
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit(aoSubmeter)} className="space-y-4">
      <FormError>{errors.root?.message}</FormError>
      <Field id="cultura-nome" label="Nome" error={errors.nome?.message}>
        <Input id="cultura-nome" {...register('nome')} />
      </Field>
      <Field id="cultura-ciclo" label="Ciclo (dias)" error={errors.ciclo_dias?.message}>
        <Input id="cultura-ciclo" inputMode="numeric" {...register('ciclo_dias')} />
      </Field>

      <div className="space-y-3">
        <FieldLabel>Fases</FieldLabel>
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-wrap items-end gap-2">
            <Field id={`fase-${index}-nome`} label="Fase" error={errors.fases?.[index]?.nome?.message}>
              <Input id={`fase-${index}-nome`} {...register(`fases.${index}.nome` as const)} />
            </Field>
            <Field id={`fase-${index}-inicio`} label="Dia início" error={errors.fases?.[index]?.dia_inicio?.message}>
              <Input id={`fase-${index}-inicio`} inputMode="numeric" {...register(`fases.${index}.dia_inicio` as const)} />
            </Field>
            <Field id={`fase-${index}-fim`} label="Dia fim" error={errors.fases?.[index]?.dia_fim?.message}>
              <Input id={`fase-${index}-fim`} inputMode="numeric" {...register(`fases.${index}.dia_fim` as const)} />
            </Field>
            <Button type="button" variant="danger-ghost" size="sm" onClick={() => remove(index)}>
              <IconTrash className="h-4 w-4" /> Remover
            </Button>
          </div>
        ))}
        {typeof errors.fases?.message === 'string' && <FormError>{errors.fases.message}</FormError>}
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ nome: '', dia_inicio: '', dia_fim: '' })}>
          <IconPlus className="h-4 w-4" /> Adicionar fase
        </Button>
      </div>

      <div className="flex gap-3">
        <Button type="submit">Salvar</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/CulturaForm.test.tsx`
Expected: all 7 tests PASS.

- [ ] **Step 9: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/api/culturas.ts frontend/src/api/culturas.test.ts frontend/src/components/CulturaForm.tsx frontend/src/components/CulturaForm.test.tsx
git commit -m "feat(frontend): adicionar CulturaForm com lista dinamica de fases"
```

---

### Task 4: Frontend — CulturasPage wiring (criar/editar/excluir)

**Files:**
- Modify: `frontend/src/pages/CulturasPage.tsx`
- Modify: `frontend/src/pages/CulturasPage.test.tsx`

**Interfaces:**
- Consumes: `criarCultura`, `atualizarCultura`, `excluirCultura`,
  `Cultura`, `CulturaInput` (Task 3), `CulturaForm` (Task 3).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/pages/CulturasPage.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CulturasPage } from './CulturasPage'
import * as culturasApi from '../api/culturas'
import { ApiError } from '../lib/api-client'

vi.mock('../api/culturas')

function renderComProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CulturasPage />
    </QueryClientProvider>,
  )
}

const embutida = { id: 1, nome: 'Tomate', ciclo_dias: 90, fases: [], somente_leitura: true }
const propria = { id: 2, nome: 'Tomate Cereja', ciclo_dias: 70, fases: [], somente_leitura: false }

describe('CulturasPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lista carrega e mostra nome e ciclo de cada cultura', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([embutida])

    renderComProvider()

    expect(await screen.findByText(/Tomate.*90 dias/)).toBeInTheDocument()
  })

  it('expandir uma cultura mostra suas fases na ordem certa', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([
      {
        ...embutida,
        fases: [
          { id: 1, nome: 'Muda', dia_inicio: 0, dia_fim: 20 },
          { id: 2, nome: 'Floracao', dia_inicio: 21, dia_fim: 50 },
        ],
      },
    ])

    renderComProvider()
    await userEvent.click(await screen.findByText(/Tomate/))

    const fases = screen.getAllByText(/dia \d+ a \d+/)
    expect(fases[0]).toHaveTextContent('Muda')
    expect(fases[1]).toHaveTextContent('Floracao')
  })

  it('cultura embutida nao mostra editar ou excluir', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([embutida])

    renderComProvider()
    await screen.findByText(/Tomate/)

    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.queryByText('Excluir')).not.toBeInTheDocument()
  })

  it('cultura propria mostra editar e excluir', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])

    renderComProvider()
    await screen.findByText(/Tomate Cereja/)

    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeInTheDocument()
  })

  it('criar uma cultura nova chama criarCultura e atualiza a lista', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([])
    vi.mocked(culturasApi.criarCultura).mockResolvedValue(propria)

    renderComProvider()
    await userEvent.click(await screen.findByText('+ Cultura'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Tomate Cereja')
    await userEvent.type(screen.getByLabelText('Ciclo (dias)'), '70')
    await userEvent.type(screen.getByLabelText('Fase'), 'Muda')
    await userEvent.type(screen.getByLabelText('Dia início'), '0')
    await userEvent.type(screen.getByLabelText('Dia fim'), '20')
    await userEvent.click(screen.getByText('Salvar'))

    expect(culturasApi.criarCultura).toHaveBeenCalledWith({
      nome: 'Tomate Cereja',
      ciclo_dias: 70,
      fases: [{ nome: 'Muda', dia_inicio: 0, dia_fim: 20 }],
    })
  })

  it('editar uma cultura propria pre-popula o formulario e chama atualizarCultura', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])
    vi.mocked(culturasApi.atualizarCultura).mockResolvedValue(propria)

    renderComProvider()
    await userEvent.click(await screen.findByText('Editar'))

    expect(screen.getByLabelText('Nome')).toHaveValue('Tomate Cereja')

    await userEvent.click(screen.getByText('Salvar'))

    expect(culturasApi.atualizarCultura).toHaveBeenCalledWith(2, expect.objectContaining({ nome: 'Tomate Cereja' }))
  })

  it('excluir uma cultura propria abre confirmacao e chama excluirCultura ao confirmar', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])
    vi.mocked(culturasApi.excluirCultura).mockResolvedValue(undefined)

    renderComProvider()
    await userEvent.click(await screen.findByText('Excluir'))
    await screen.findByText('Tem certeza que deseja excluir esta cultura?')
    await userEvent.click(screen.getByText('Confirmar'))

    expect(culturasApi.excluirCultura).toHaveBeenCalledWith(2)
  })

  it('erro ao excluir cultura em uso aparece no dialogo sem fecha-lo', async () => {
    vi.mocked(culturasApi.listarCulturas).mockResolvedValue([propria])
    vi.mocked(culturasApi.excluirCultura).mockRejectedValue(
      new ApiError(409, 'Não é possível excluir: existem registros vinculados a este item.'),
    )

    renderComProvider()
    await userEvent.click(await screen.findByText('Excluir'))
    await screen.findByText('Tem certeza que deseja excluir esta cultura?')
    await userEvent.click(screen.getByText('Confirmar'))

    expect(await screen.findByText('Não é possível excluir: existem registros vinculados a este item.')).toBeInTheDocument()
  })
})
```

`ConfirmDialog` (`frontend/src/components/ConfirmDialog.tsx`) always
labels its confirm button "Confirmar" and cancel button "Cancelar" —
these two tests click `screen.getByText('Confirmar')` directly, no
structural DOM traversal needed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/CulturasPage.test.tsx`
Expected: FAIL — no "+ Cultura" button, no Editar/Excluir actions yet.

- [ ] **Step 3: Implement the page**

Replace the full contents of `frontend/src/pages/CulturasPage.tsx` with:

```tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  atualizarCultura,
  criarCultura,
  excluirCultura,
  listarCulturas,
  type Cultura,
  type CulturaInput,
} from '../api/culturas'
import { ApiError, paraApiError } from '../lib/api-client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CulturaForm } from '../components/CulturaForm'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconChevronDown,
  IconPencil,
  IconTrash,
  LoadingState,
  PageHeader,
} from '../components/ui'

type FormularioAberto = { tipo: 'novo' } | { tipo: 'editar'; cultura: Cultura } | null

export function CulturasPage() {
  const queryClient = useQueryClient()
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())
  const [formulario, setFormulario] = useState<FormularioAberto>(null)
  const [erroFormulario, setErroFormulario] = useState<ApiError | null>(null)
  const [exclusaoPendente, setExclusaoPendente] = useState<Cultura | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const culturasQuery = useQuery({ queryKey: ['culturas'], queryFn: listarCulturas })

  function alternarExpansao(culturaId: number) {
    setExpandidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(culturaId)) {
        proximo.delete(culturaId)
      } else {
        proximo.add(culturaId)
      }
      return proximo
    })
  }

  function abrirFormulario(proximo: FormularioAberto) {
    setErroFormulario(null)
    setFormulario(proximo)
  }

  const criarMutation = useMutation({
    mutationFn: criarCultura,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culturas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: CulturaInput }) => atualizarCultura(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culturas'] })
      setErroFormulario(null)
      setFormulario(null)
    },
    onError: (erro) => setErroFormulario(paraApiError(erro)),
  })

  const excluirMutation = useMutation({
    mutationFn: excluirCultura,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['culturas'] })
      setExclusaoPendente(null)
      setErroExclusao(null)
    },
    onError: (erro) => setErroExclusao(paraApiError(erro).message),
  })

  if (culturasQuery.isLoading) {
    return <LoadingState />
  }

  if (culturasQuery.isError) {
    return <ErrorState message="Não foi possível carregar as culturas." onRetry={() => culturasQuery.refetch()} />
  }

  const culturas = culturasQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="Culturas"
        action={
          <Button size="sm" onClick={() => abrirFormulario({ tipo: 'novo' })}>
            + Cultura
          </Button>
        }
      />

      {formulario?.tipo === 'novo' && (
        <Card className="mb-5 p-5">
          <CulturaForm
            erro={erroFormulario}
            onSubmit={(input) => criarMutation.mutate(input)}
            onCancel={() => abrirFormulario(null)}
          />
        </Card>
      )}

      {culturas.length === 0 && formulario?.tipo !== 'novo' && <EmptyState>Nenhuma cultura cadastrada ainda.</EmptyState>}

      <ul className="space-y-3">
        {culturas.map((cultura) => {
          if (formulario?.tipo === 'editar' && formulario.cultura.id === cultura.id) {
            return (
              <li key={cultura.id}>
                <Card className="p-5">
                  <CulturaForm
                    cultura={cultura}
                    erro={erroFormulario}
                    onSubmit={(input) => atualizarMutation.mutate({ id: cultura.id, input })}
                    onCancel={() => abrirFormulario(null)}
                  />
                </Card>
              </li>
            )
          }

          const expandida = expandidas.has(cultura.id)
          return (
            <li key={cultura.id}>
              <Card>
                <div className="flex items-center gap-2 px-4 py-3.5">
                  <button
                    onClick={() => alternarExpansao(cultura.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={expandida}
                  >
                    <IconChevronDown
                      className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${expandida ? '' : '-rotate-90'}`}
                    />
                    <span className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">
                      {cultura.nome} ({cultura.ciclo_dias} dias)
                    </span>
                  </button>
                  {!cultura.somente_leitura && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirFormulario({ tipo: 'editar', cultura })}>
                        <IconPencil className="h-4 w-4" /> Editar
                      </Button>
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        onClick={() => {
                          setErroExclusao(null)
                          setExclusaoPendente(cultura)
                        }}
                      >
                        <IconTrash className="h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  )}
                </div>
                {expandida && (
                  <ul className="dashed-divider px-4 pb-3 pt-1">
                    {cultura.fases.map((fase) => (
                      <li
                        key={fase.id}
                        className="border-b border-dashed border-line py-2.5 font-display font-semibold text-ink last:border-0"
                      >
                        {fase.nome}: dia {fase.dia_inicio} a {fase.dia_fim}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        aberto={exclusaoPendente !== null}
        titulo="Excluir cultura"
        mensagem="Tem certeza que deseja excluir esta cultura?"
        erro={erroExclusao ?? undefined}
        onConfirm={() => {
          if (exclusaoPendente) excluirMutation.mutate(exclusaoPendente.id)
        }}
        onCancel={() => {
          setExclusaoPendente(null)
          setErroExclusao(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/CulturasPage.test.tsx`
Expected: all tests PASS.

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full frontend suite to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/CulturasPage.tsx frontend/src/pages/CulturasPage.test.tsx
git commit -m "feat(frontend): permitir criar/editar/excluir cultura propria em CulturasPage"
```
