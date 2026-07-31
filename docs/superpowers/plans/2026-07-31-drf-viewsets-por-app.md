# Serializers/Views/Permissions DRF por App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose every domain model (Propriedade, Talhao, Cultura, Plantio, Insumo, AplicacaoInsumo, Tarefa, Colheita, LancamentoFinanceiro, Trabalhador, Diaria) as an authenticated, multi-tenant-isolated REST API, using the `UsuarioScopedQuerySetMixin` and JWT auth already built in Task #5.

**Architecture:** Each app gets `serializers.py` + `views.py`. Every `ModelViewSet` (except `Cultura`, which is read-only) inherits `core.permissions.UsuarioScopedQuerySetMixin` with the correct `usuario_lookup` for that model's ownership chain — this covers the READ side of tenant isolation (404 on cross-tenant access). The WRITE side (a payload referencing another user's FK) is covered by scoping each serializer's FK field querysets to `request.user` in `__init__` — this makes referencing another user's object fail with `400` (invalid pk) instead of silently succeeding. A single `DefaultRouter` in `core/urls.py`, created in Task 1, is extended incrementally by every later task. Tasks execute in the same dependency order as the original models plan (properties → crops → plantings → inputs → tasks/harvest/finance) because each app's serializer needs the parent app's model already scopeable. Full spec: `docs/superpowers/specs/2026-07-31-drf-viewsets-por-app-design.md`.

**Tech Stack:** Django 6.0, DRF 3.17, `djangorestframework-simplejwt` (already installed), pytest + pytest-django, SQLite dev database.

## Global Constraints

- No pagination, no `django-filter` — explicitly out of scope for this plan (RNF01: low volume; client-side filtering is acceptable for now).
- Every `ModelViewSet` with an owner (direct or indirect) inherits `core.permissions.UsuarioScopedQuerySetMixin` with `usuario_lookup` set per this table (from the spec):
  - `Propriedade` → `"usuario"` · `Talhao` → `"propriedade__usuario"` · `Plantio` → `"talhao__propriedade__usuario"` · `Insumo` → `"usuario"` · `AplicacaoInsumo` → `"plantio__talhao__propriedade__usuario"` · `Tarefa` → `"plantio__talhao__propriedade__usuario"` · `Colheita` → `"plantio__talhao__propriedade__usuario"` · `LancamentoFinanceiro` → `"plantio__talhao__propriedade__usuario"` · `Trabalhador` → `"usuario"` · `Diaria` → `"plantio__talhao__propriedade__usuario"`.
  - `Cultura` gets NO mixin, NO `usuario_lookup` — shared catalog (ADR 002 exception), `ReadOnlyModelViewSet`.
- Every serializer with a "parent" FK field (e.g. `Talhao.propriedade`, `Plantio.talhao`, `AplicacaoInsumo.plantio`/`.insumo`, `Diaria.trabalhador`/`.plantio`, `Tarefa.plantio`, `Colheita.plantio`, `LancamentoFinanceiro.plantio`) restricts that field's `queryset` to the authenticated user's own objects, in `__init__`:
  ```python
  def __init__(self, *args, **kwargs):
      super().__init__(*args, **kwargs)
      request = self.context.get("request")
      if request and request.user.is_authenticated:
          self.fields["<campo>"].queryset = <Model>.objects.filter(<lookup>=request.user)
  ```
  Exception: `Plantio.cultura` is NEVER scoped this way — `Cultura` is a shared catalog, any cultura is valid for any user.
- Models with a DIRECT `usuario` FK (`Propriedade`, `Insumo`, `Trabalhador`) do NOT expose `usuario` in the serializer's `fields` — it's set in `perform_create`: `serializer.save(usuario=self.request.user)`.
- `AplicacaoInsumo` does NOT expose `created_by` in the serializer's `fields` — set in `perform_create`: `serializer.save(created_by=self.request.user)` (ADR 007 audit trail).
- `Diaria` does NOT expose `valor` or `lancamento` as writable — both are `read_only_fields` (valor is auto-computed by the model's `save()` override; lancamento is only ever set by the `pagar-diarias` action).
- New shared test fixture: `lagoagro/tests/conftest.py` (created in Task 1) with a `criar_usuario_autenticado` factory fixture that creates a user AND logs them in via a real HTTP call to `/api/auth/login/`, returning `(usuario, client)` with the access token already attached via `client.credentials(...)`. Every task's test file uses this instead of `force_authenticate` — the point of these tests is to prove serializer + mixin + routing compose correctly end-to-end, which `force_authenticate` would partially bypass. This is a deliberate exception to this codebase's usual per-file-local-helper convention (justified: the helper here does a real HTTP round-trip, not just a few ORM creates, so duplicating it across 7 files is a real cost this time).
- Router: a single `DefaultRouter` instance in `core/urls.py`, created in Task 1 (`router = DefaultRouter()`), with `router.register(...)` calls added incrementally by each task, before `urlpatterns` is built. `urlpatterns` includes `path('api/', include(router.urls))`.
- Route prefixes (exact, from the spec): `propriedades`, `talhoes`, `culturas`, `plantios`, `insumos`, `aplicacoes-insumo`, `tarefas`, `colheitas`, `lancamentos-financeiros`, `trabalhadores`, `diarias`.
- Test files: one per app, `lagoagro/tests/test_<app>_views.py`.
- Conventional Commits: scope matches the app being touched (`properties`, `crops`, `plantings`, `inputs`, `tasks`, `harvest`, `finance`) for that task's serializer/view/test commit; the router/urls.py change in each task is part of that same commit (it's the same logical change — "add the viewset and wire it up").
- All commands assume working directory `lagoagro/`, using `uv run pytest` / `uv run python manage.py ...`.

---

### Task 1: properties (Propriedade, Talhao) + router setup

**Files:**
- Create: `lagoagro/properties/serializers.py`
- Create: `lagoagro/properties/views.py`
- Create: `lagoagro/tests/conftest.py`
- Create: `lagoagro/tests/test_properties_views.py`
- Modify: `lagoagro/core/urls.py`

**Interfaces:**
- Consumes: `core.permissions.UsuarioScopedQuerySetMixin` (Task #5), `properties.models.Propriedade`/`Talhao` (existing).
- Produces: `properties.views.PropriedadeViewSet`, `properties.views.TalhaoViewSet`, routes `/api/propriedades/`, `/api/talhoes/`. `lagoagro/tests/conftest.py::criar_usuario_autenticado` fixture — every later task's tests import nothing from it (it's a pytest fixture, auto-discovered), just declare it as a test function parameter.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/conftest.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture
def criar_usuario_autenticado(db):
    def _criar(username="produtor1"):
        usuario = get_user_model().objects.create_user(username=username, password="senha123")
        client = APIClient()
        login = client.post("/api/auth/login/", {"username": username, "password": "senha123"})
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        return usuario, client

    return _criar
```

```python
# lagoagro/tests/test_properties_views.py
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from properties.models import Propriedade


def test_criar_propriedade_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/propriedades/", {"nome": "Sitio Boa Vista"})

    assert response.status_code == 201
    assert Propriedade.objects.get(id=response.data["id"]).usuario == usuario


def test_listar_propriedades_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    response = client.get("/api/propriedades/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["nome"] == "Sitio Boa Vista"


def test_acessar_propriedade_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")

    response = client.get(f"/api/propriedades/{propriedade_outro.id}/")

    assert response.status_code == 404


def test_criar_talhao_com_propriedade_propria_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    response = client.post("/api/talhoes/", {
        "propriedade": propriedade.id, "nome": "Talhao 1", "area": "2.50", "tipo_solo": "argiloso",
    })

    assert response.status_code == 201


def test_criar_talhao_com_propriedade_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")

    response = client.post("/api/talhoes/", {
        "propriedade": propriedade_outro.id, "nome": "Talhao X", "area": "1.00", "tipo_solo": "arenoso",
    })

    assert response.status_code == 400


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/propriedades/")

    assert response.status_code == 401
```

Note: no `pytestmark = pytest.mark.django_db` at module level in this file — the `criar_usuario_autenticado` fixture already declares `db` as a dependency, which gives DB access to every test using it. `test_requisicao_sem_token_retorna_401` doesn't need DB access at all (no user/DB object is created), so it's fine without the marker.

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_properties_views.py -v`
Expected: FAIL — 404s (no `/api/propriedades/`/`/api/talhoes/` routes yet).

- [ ] **Step 3: Write the serializers**

```python
# lagoagro/properties/serializers.py
from rest_framework import serializers

from .models import Propriedade, Talhao


class PropriedadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Propriedade
        fields = ["id", "nome"]


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

- [ ] **Step 4: Write the views**

```python
# lagoagro/properties/views.py
from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Propriedade, Talhao
from .serializers import PropriedadeSerializer, TalhaoSerializer


class PropriedadeViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Propriedade.objects.all()
    serializer_class = PropriedadeSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class TalhaoViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Talhao.objects.all()
    serializer_class = TalhaoSerializer
    usuario_lookup = "propriedade__usuario"
```

- [ ] **Step 5: Wire the router**

```python
# lagoagro/core/urls.py
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.auth_views import LoginView, LogoutView, RefreshView
from properties.views import PropriedadeViewSet, TalhaoViewSet

router = DefaultRouter()
router.register("propriedades", PropriedadeViewSet)
router.register("talhoes", TalhaoViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/', include(router.urls)),
]
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_properties_views.py -v`
Expected: PASS (6 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (72 — 66 existing + 6 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/properties/serializers.py lagoagro/properties/views.py lagoagro/tests/conftest.py lagoagro/tests/test_properties_views.py lagoagro/core/urls.py
git commit -m "feat(properties): adicionar serializers e viewsets DRF"
```

---

### Task 2: crops (Cultura, somente leitura)

**Files:**
- Create: `lagoagro/crops/serializers.py`
- Create: `lagoagro/crops/views.py`
- Create: `lagoagro/tests/test_crops_views.py`
- Modify: `lagoagro/core/urls.py`

**Interfaces:**
- Consumes: `crops.models.Cultura`/`FaseCultura` (existing).
- Produces: `crops.views.CulturaViewSet`, route `/api/culturas/` (read-only). Task 3 (`plantings`) references `Cultura` in `Plantio.cultura` but does NOT scope it by user (shared catalog) — no dependency on this task's viewset, only on the model.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_crops_views.py
from rest_framework.test import APIClient

from crops.models import Cultura, FaseCultura


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


def test_criar_cultura_via_api_nao_e_permitido(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()

    response = client.post("/api/culturas/", {"nome": "Milho", "ciclo_dias": 100})

    assert response.status_code == 405


def test_listar_culturas_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/culturas/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_crops_views.py -v`
Expected: FAIL — 404s (no `/api/culturas/` route yet).

- [ ] **Step 3: Write the serializers**

```python
# lagoagro/crops/serializers.py
from rest_framework import serializers

from .models import Cultura, FaseCultura


class FaseCulturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaseCultura
        fields = ["id", "nome", "dia_inicio", "dia_fim"]


class CulturaSerializer(serializers.ModelSerializer):
    fases = FaseCulturaSerializer(many=True, read_only=True)

    class Meta:
        model = Cultura
        fields = ["id", "nome", "ciclo_dias", "fases"]
```

- [ ] **Step 4: Write the views**

```python
# lagoagro/crops/views.py
from rest_framework import viewsets

from .models import Cultura
from .serializers import CulturaSerializer


class CulturaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cultura.objects.all()
    serializer_class = CulturaSerializer
```

- [ ] **Step 5: Wire the router**

In `lagoagro/core/urls.py`, add the import and registration:

```python
from crops.views import CulturaViewSet
```

```python
router.register("culturas", CulturaViewSet)
```

(Add these alongside the existing `properties` import/registration from Task 1 — don't remove anything.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_crops_views.py -v`
Expected: PASS (3 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (75 — 72 existing + 3 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/crops/serializers.py lagoagro/crops/views.py lagoagro/tests/test_crops_views.py lagoagro/core/urls.py
git commit -m "feat(crops): adicionar viewset somente leitura de Cultura com fases aninhadas"
```

---

### Task 3: plantings (Plantio)

**Files:**
- Create: `lagoagro/plantings/serializers.py`
- Create: `lagoagro/plantings/views.py`
- Create: `lagoagro/tests/test_plantings_views.py`
- Modify: `lagoagro/core/urls.py`

**Interfaces:**
- Consumes: `properties.models.Talhao`, `crops.models.Cultura` (existing), `core.permissions.UsuarioScopedQuerySetMixin`.
- Produces: `plantings.views.PlantioViewSet`, route `/api/plantios/`. Tasks 4-7 (`inputs`, `tasks`, `harvest`, `finance`) all reference `Plantio` the same way this task establishes (`talhao__propriedade__usuario` lookup pattern) but don't import anything from this task's files directly.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_plantings_views.py
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def test_criar_plantio_com_talhao_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    response = client.post("/api/plantios/", {
        "talhao": talhao.id, "cultura": cultura.id, "data_plantio": "2026-01-01",
    })

    assert response.status_code == 201


def test_criar_plantio_com_talhao_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    response = client.post("/api/plantios/", {
        "talhao": talhao_outro.id, "cultura": cultura.id, "data_plantio": "2026-01-01",
    })

    assert response.status_code == 400


def test_listar_plantios_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    Plantio.objects.create(talhao=talhao_outro, cultura=cultura, data_plantio="2026-01-01")

    response = client.get("/api/plantios/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_plantio_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio_outro = Plantio.objects.create(talhao=talhao_outro, cultura=cultura, data_plantio="2026-01-01")

    response = client.get(f"/api/plantios/{plantio_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/plantios/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_plantings_views.py -v`
Expected: FAIL — 404s (no `/api/plantios/` route yet).

- [ ] **Step 3: Write the serializer**

```python
# lagoagro/plantings/serializers.py
from rest_framework import serializers

from properties.models import Talhao

from .models import Plantio


class PlantioSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["talhao"].queryset = Talhao.objects.filter(propriedade__usuario=request.user)

    class Meta:
        model = Plantio
        fields = ["id", "talhao", "cultura", "data_plantio", "status"]
```

Note: `cultura` is intentionally NOT scoped — any `Cultura` is valid for any user (shared catalog).

- [ ] **Step 4: Write the view**

```python
# lagoagro/plantings/views.py
from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Plantio
from .serializers import PlantioSerializer


class PlantioViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Plantio.objects.all()
    serializer_class = PlantioSerializer
    usuario_lookup = "talhao__propriedade__usuario"
```

- [ ] **Step 5: Wire the router**

In `lagoagro/core/urls.py`, add:

```python
from plantings.views import PlantioViewSet
```

```python
router.register("plantios", PlantioViewSet)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_plantings_views.py -v`
Expected: PASS (5 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (80 — 75 existing + 5 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/plantings/serializers.py lagoagro/plantings/views.py lagoagro/tests/test_plantings_views.py lagoagro/core/urls.py
git commit -m "feat(plantings): adicionar serializer e viewset DRF de Plantio"
```

---

### Task 4: inputs (Insumo, AplicacaoInsumo)

**Files:**
- Create: `lagoagro/inputs/serializers.py`
- Create: `lagoagro/inputs/views.py`
- Create: `lagoagro/tests/test_inputs_views.py`
- Modify: `lagoagro/core/urls.py`

**Interfaces:**
- Consumes: `plantings.models.Plantio` (Task 3), `core.permissions.UsuarioScopedQuerySetMixin`.
- Produces: `inputs.views.InsumoViewSet`, `inputs.views.AplicacaoInsumoViewSet`, routes `/api/insumos/`, `/api/aplicacoes-insumo/`.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_inputs_views.py
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_criar_insumo_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/insumos/", {"nome": "ProdutoX", "tipo": "veneno", "carencia_dias": 7})

    assert response.status_code == 201
    assert Insumo.objects.get(id=response.data["id"]).usuario == usuario


def test_listar_insumos_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    Insumo.objects.create(usuario=outro, nome="ProdutoY", tipo="adubo", carencia_dias=0)
    Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    response = client.get("/api/insumos/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_criar_aplicacao_com_plantio_e_insumo_proprios_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    response = client.post("/api/aplicacoes-insumo/", {
        "plantio": plantio.id, "insumo": insumo.id, "data": "2026-02-01", "quantidade": "1.50",
    })

    assert response.status_code == 201
    assert AplicacaoInsumo.objects.get(id=response.data["id"]).created_by == usuario


def test_criar_aplicacao_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    response = client.post("/api/aplicacoes-insumo/", {
        "plantio": plantio_outro.id, "insumo": insumo.id, "data": "2026-02-01", "quantidade": "1.50",
    })

    assert response.status_code == 400


def test_criar_aplicacao_com_insumo_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    insumo_outro = Insumo.objects.create(usuario=outro, nome="ProdutoY", tipo="adubo", carencia_dias=0)

    response = client.post("/api/aplicacoes-insumo/", {
        "plantio": plantio.id, "insumo": insumo_outro.id, "data": "2026-02-01", "quantidade": "1.50",
    })

    assert response.status_code == 400


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/insumos/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_inputs_views.py -v`
Expected: FAIL — 404s (no routes yet).

- [ ] **Step 3: Write the serializers**

```python
# lagoagro/inputs/serializers.py
from rest_framework import serializers

from plantings.models import Plantio

from .models import AplicacaoInsumo, Insumo


class InsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insumo
        fields = ["id", "nome", "tipo", "carencia_dias"]


class AplicacaoInsumoSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)
            self.fields["insumo"].queryset = Insumo.objects.filter(usuario=request.user)

    class Meta:
        model = AplicacaoInsumo
        fields = ["id", "plantio", "insumo", "data", "quantidade"]
```

- [ ] **Step 4: Write the views**

```python
# lagoagro/inputs/views.py
from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import AplicacaoInsumo, Insumo
from .serializers import AplicacaoInsumoSerializer, InsumoSerializer


class InsumoViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Insumo.objects.all()
    serializer_class = InsumoSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class AplicacaoInsumoViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = AplicacaoInsumo.objects.all()
    serializer_class = AplicacaoInsumoSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
```

- [ ] **Step 5: Wire the router**

In `lagoagro/core/urls.py`, add:

```python
from inputs.views import AplicacaoInsumoViewSet, InsumoViewSet
```

```python
router.register("insumos", InsumoViewSet)
router.register("aplicacoes-insumo", AplicacaoInsumoViewSet)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_inputs_views.py -v`
Expected: PASS (6 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (86 — 80 existing + 6 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/inputs/serializers.py lagoagro/inputs/views.py lagoagro/tests/test_inputs_views.py lagoagro/core/urls.py
git commit -m "feat(inputs): adicionar serializers e viewsets DRF de Insumo e AplicacaoInsumo"
```

---

### Task 5: tasks (Tarefa)

**Files:**
- Create: `lagoagro/tasks/serializers.py`
- Create: `lagoagro/tasks/views.py`
- Create: `lagoagro/tests/test_tasks_views.py`
- Modify: `lagoagro/core/urls.py`

**Interfaces:**
- Consumes: `plantings.models.Plantio` (Task 3), `core.permissions.UsuarioScopedQuerySetMixin`.
- Produces: `tasks.views.TarefaViewSet`, route `/api/tarefas/`.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_tasks_views.py
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from plantings.models import Plantio
from properties.models import Propriedade, Talhao
from tasks.models import Tarefa


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_criar_tarefa_com_plantio_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/tarefas/", {
        "plantio": plantio.id, "descricao": "Aplicar defensivo", "data": "2026-02-01",
    })

    assert response.status_code == 201
    assert response.data["concluida"] is False


def test_criar_tarefa_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)

    response = client.post("/api/tarefas/", {
        "plantio": plantio_outro.id, "descricao": "Aplicar defensivo", "data": "2026-02-01",
    })

    assert response.status_code == 400


def test_listar_tarefas_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    Tarefa.objects.create(plantio=plantio, descricao="Minha tarefa", data="2026-02-01")
    Tarefa.objects.create(plantio=plantio_outro, descricao="Tarefa de outro", data="2026-02-01")

    response = client.get("/api/tarefas/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_tarefa_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    tarefa_outro = Tarefa.objects.create(plantio=plantio_outro, descricao="Tarefa de outro", data="2026-02-01")

    response = client.get(f"/api/tarefas/{tarefa_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/tarefas/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_tasks_views.py -v`
Expected: FAIL — 404s (no `/api/tarefas/` route yet).

- [ ] **Step 3: Write the serializer**

```python
# lagoagro/tasks/serializers.py
from rest_framework import serializers

from plantings.models import Plantio

from .models import Tarefa


class TarefaSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = Tarefa
        fields = ["id", "plantio", "descricao", "data", "concluida"]
```

- [ ] **Step 4: Write the view**

```python
# lagoagro/tasks/views.py
from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Tarefa
from .serializers import TarefaSerializer


class TarefaViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Tarefa.objects.all()
    serializer_class = TarefaSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"
```

- [ ] **Step 5: Wire the router**

In `lagoagro/core/urls.py`, add:

```python
from tasks.views import TarefaViewSet
```

```python
router.register("tarefas", TarefaViewSet)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_tasks_views.py -v`
Expected: PASS (5 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (91 — 86 existing + 5 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/tasks/serializers.py lagoagro/tasks/views.py lagoagro/tests/test_tasks_views.py lagoagro/core/urls.py
git commit -m "feat(tasks): adicionar serializer e viewset DRF de Tarefa"
```

---

### Task 6: harvest (Colheita)

**Files:**
- Create: `lagoagro/harvest/serializers.py`
- Create: `lagoagro/harvest/views.py`
- Create: `lagoagro/tests/test_harvest_views.py`
- Modify: `lagoagro/core/urls.py`

**Interfaces:**
- Consumes: `plantings.models.Plantio` (Task 3), `core.permissions.UsuarioScopedQuerySetMixin`.
- Produces: `harvest.views.ColheitaViewSet`, route `/api/colheitas/`.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_harvest_views.py
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from harvest.models import Colheita
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_criar_colheita_com_plantio_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/colheitas/", {
        "plantio": plantio.id, "data": "2026-04-01", "classificacao": "primeira", "quantidade": "50.00",
    })

    assert response.status_code == 201


def test_criar_colheita_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)

    response = client.post("/api/colheitas/", {
        "plantio": plantio_outro.id, "data": "2026-04-01", "classificacao": "primeira", "quantidade": "50.00",
    })

    assert response.status_code == 400


def test_listar_colheitas_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    Colheita.objects.create(plantio=plantio, data="2026-04-01", classificacao="primeira", quantidade="50.00")
    Colheita.objects.create(plantio=plantio_outro, data="2026-04-01", classificacao="primeira", quantidade="30.00")

    response = client.get("/api/colheitas/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_colheita_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    colheita_outro = Colheita.objects.create(plantio=plantio_outro, data="2026-04-01", classificacao="primeira", quantidade="30.00")

    response = client.get(f"/api/colheitas/{colheita_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/colheitas/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_harvest_views.py -v`
Expected: FAIL — 404s (no `/api/colheitas/` route yet).

- [ ] **Step 3: Write the serializer**

```python
# lagoagro/harvest/serializers.py
from rest_framework import serializers

from plantings.models import Plantio

from .models import Colheita


class ColheitaSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = Colheita
        fields = ["id", "plantio", "data", "classificacao", "quantidade"]
```

- [ ] **Step 4: Write the view**

```python
# lagoagro/harvest/views.py
from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Colheita
from .serializers import ColheitaSerializer


class ColheitaViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Colheita.objects.all()
    serializer_class = ColheitaSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"
```

- [ ] **Step 5: Wire the router**

In `lagoagro/core/urls.py`, add:

```python
from harvest.views import ColheitaViewSet
```

```python
router.register("colheitas", ColheitaViewSet)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_harvest_views.py -v`
Expected: PASS (5 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (96 — 91 existing + 5 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/harvest/serializers.py lagoagro/harvest/views.py lagoagro/tests/test_harvest_views.py lagoagro/core/urls.py
git commit -m "feat(harvest): adicionar serializer e viewset DRF de Colheita"
```

---

### Task 7: finance (LancamentoFinanceiro, Trabalhador, Diaria + ação pagar-diarias)

**Files:**
- Create: `lagoagro/finance/serializers.py`
- Create: `lagoagro/finance/views.py`
- Create: `lagoagro/tests/test_finance_views.py`
- Modify: `lagoagro/core/urls.py`

**Interfaces:**
- Consumes: `plantings.models.Plantio` (Task 3), `finance.services.pagar_diarias_pendentes` (existing, from the `trabalhadores-diarias` branch), `core.permissions.UsuarioScopedQuerySetMixin`.
- Produces: `finance.views.LancamentoFinanceiroViewSet`, `finance.views.TrabalhadorViewSet` (with `pagar-diarias` action), `finance.views.DiariaViewSet`. Routes `/api/lancamentos-financeiros/`, `/api/trabalhadores/` (+ `/api/trabalhadores/{id}/pagar-diarias/`), `/api/diarias/`. This is the last task of the plan.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_finance_views.py
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from finance.models import Diaria, LancamentoFinanceiro, Trabalhador
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


# --- LancamentoFinanceiro ---

def test_criar_lancamento_com_plantio_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio.id, "valor": "150.00", "data": "2026-01-15", "descricao": "Compra de mudas", "setor": "insumos",
    })

    assert response.status_code == 201


def test_criar_lancamento_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio_outro.id, "valor": "150.00", "data": "2026-01-15", "descricao": "Compra de mudas", "setor": "insumos",
    })

    assert response.status_code == 400


def test_listar_lancamentos_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    LancamentoFinanceiro.objects.create(plantio=plantio, valor="150.00", data="2026-01-15", descricao="Meu gasto", setor="insumos")
    LancamentoFinanceiro.objects.create(plantio=plantio_outro, valor="100.00", data="2026-01-15", descricao="Gasto de outro", setor="insumos")

    response = client.get("/api/lancamentos-financeiros/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_lancamento_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    lancamento_outro = LancamentoFinanceiro.objects.create(plantio=plantio_outro, valor="100.00", data="2026-01-15", descricao="Gasto de outro", setor="insumos")

    response = client.get(f"/api/lancamentos-financeiros/{lancamento_outro.id}/")

    assert response.status_code == 404


# --- Trabalhador ---

def test_criar_trabalhador_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/trabalhadores/", {"nome": "Joao", "valor_diaria": "120.00"})

    assert response.status_code == 201
    assert Trabalhador.objects.get(id=response.data["id"]).usuario == usuario


def test_listar_trabalhadores_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))
    Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    response = client.get("/api/trabalhadores/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_trabalhador_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))

    response = client.get(f"/api/trabalhadores/{trabalhador_outro.id}/")

    assert response.status_code == 404


# --- Diaria ---

def test_criar_diaria_com_trabalhador_e_plantio_proprios_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    response = client.post("/api/diarias/", {
        "trabalhador": trabalhador.id, "plantio": plantio.id, "data": "2026-02-01",
    })

    assert response.status_code == 201
    assert response.data["valor"] == "120.00"


def test_criar_diaria_com_trabalhador_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))

    response = client.post("/api/diarias/", {
        "trabalhador": trabalhador_outro.id, "plantio": plantio.id, "data": "2026-02-01",
    })

    assert response.status_code == 400


def test_criar_diaria_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    response = client.post("/api/diarias/", {
        "trabalhador": trabalhador.id, "plantio": plantio_outro.id, "data": "2026-02-01",
    })

    assert response.status_code == 400


def test_listar_diarias_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")
    Diaria.objects.create(trabalhador=trabalhador_outro, plantio=plantio_outro, data="2026-02-01")

    response = client.get("/api/diarias/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_diaria_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))
    diaria_outro = Diaria.objects.create(trabalhador=trabalhador_outro, plantio=plantio_outro, data="2026-02-01")

    response = client.get(f"/api/diarias/{diaria_outro.id}/")

    assert response.status_code == 404


# --- pagar-diarias action ---

def test_pagar_diarias_pendentes_via_action_cria_lancamento(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-02")

    response = client.post(f"/api/trabalhadores/{trabalhador.id}/pagar-diarias/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["valor"] == "240.00"
    assert LancamentoFinanceiro.objects.count() == 1


def test_pagar_diarias_de_trabalhador_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))

    response = client.post(f"/api/trabalhadores/{trabalhador_outro.id}/pagar-diarias/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/lancamentos-financeiros/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_finance_views.py -v`
Expected: FAIL — 404s (no routes yet).

- [ ] **Step 3: Write the serializers**

```python
# lagoagro/finance/serializers.py
from rest_framework import serializers

from plantings.models import Plantio

from .models import Diaria, LancamentoFinanceiro, Trabalhador


class LancamentoFinanceiroSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = LancamentoFinanceiro
        fields = ["id", "plantio", "valor", "data", "descricao", "setor"]


class TrabalhadorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trabalhador
        fields = ["id", "nome", "valor_diaria", "ativo"]


class DiariaSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["trabalhador"].queryset = Trabalhador.objects.filter(usuario=request.user)
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = Diaria
        fields = ["id", "trabalhador", "plantio", "data", "valor", "lancamento"]
        read_only_fields = ["valor", "lancamento"]
```

- [ ] **Step 4: Write the views**

```python
# lagoagro/finance/views.py
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Diaria, LancamentoFinanceiro, Trabalhador
from .serializers import DiariaSerializer, LancamentoFinanceiroSerializer, TrabalhadorSerializer
from .services import pagar_diarias_pendentes


class LancamentoFinanceiroViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = LancamentoFinanceiro.objects.all()
    serializer_class = LancamentoFinanceiroSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"


class TrabalhadorViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Trabalhador.objects.all()
    serializer_class = TrabalhadorSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=["post"], url_path="pagar-diarias")
    def pagar_diarias(self, request, pk=None):
        trabalhador = self.get_object()
        lancamentos = pagar_diarias_pendentes(trabalhador)
        serializer = LancamentoFinanceiroSerializer(lancamentos, many=True)
        return Response(serializer.data)


class DiariaViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Diaria.objects.all()
    serializer_class = DiariaSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"
```

- [ ] **Step 5: Wire the router**

In `lagoagro/core/urls.py`, add:

```python
from finance.views import DiariaViewSet, LancamentoFinanceiroViewSet, TrabalhadorViewSet
```

```python
router.register("lancamentos-financeiros", LancamentoFinanceiroViewSet)
router.register("trabalhadores", TrabalhadorViewSet)
router.register("diarias", DiariaViewSet)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_finance_views.py -v`
Expected: PASS (15 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (111 — 96 existing + 15 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/finance/serializers.py lagoagro/finance/views.py lagoagro/tests/test_finance_views.py lagoagro/core/urls.py
git commit -m "feat(finance): adicionar serializers e viewsets DRF de LancamentoFinanceiro, Trabalhador e Diaria"
```

---

## Post-plan note

This plan delivers a complete, tenant-isolated REST API for every domain model. Not delivered here, left for later tasks:

- **Task #7** (job de notificação diária): unaffected by this plan — it's a management command, not an API consumer.
- **Task #8** (frontend PWA): will be the first real consumer of every endpoint built here. It needs a `Authorization: Bearer` interceptor with refresh-on-401 (per Task #5's design doc), and must handle `400` responses from the FK-scoping pattern as "this reference is invalid" (not as a generic form error) since that's how cross-tenant write attempts surface.
- **Task #9** (deploy): `django-cors-headers` (needed for the cross-origin frontend, per Task #5's design doc's out-of-scope note) is not part of this plan — add it when Task #8's actual frontend origin is known.
- Pagination and query-string filtering were explicitly deferred (Global Constraints) — if the frontend ends up needing to filter large lists (e.g. "tarefas pendentes"), that's a follow-up task, not a defect in this one.
