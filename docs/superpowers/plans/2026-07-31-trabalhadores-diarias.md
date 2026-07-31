# Trabalhadores e Diárias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `Trabalhador` (cadastro de trabalhador com valor de diária) and `Diaria` (registro diário de trabalho vinculado a um plantio) in the `finance` app, plus a `pagar_diarias_pendentes` service function that converts accumulated unpaid diárias into `LancamentoFinanceiro` records, grouped by plantio.

**Architecture:** Both models live in the existing `finance/models.py` (mão de obra is already one of `LancamentoFinanceiro.SETOR_CHOICES`; these are two small models tightly coupled to it, not a new app). `Diaria` follows the same catalog + protected-usage-record pattern already established by `inputs.Insumo` / `inputs.AplicacaoInsumo`: a reusable `Trabalhador` catalog entry, and a `Diaria` usage record that `PROTECT`s its `trabalhador` and `plantio` FKs so the audit trail can't be silently erased by deleting either. The conversion logic (`pagar_diarias_pendentes`) is a plain Django-dependent service function in `finance/services.py` — not pure enough for `domain/`, not yet wired to an HTTP endpoint (that's Task #6 of the overall project, not part of this plan).

**Tech Stack:** Django 6.0 (already installed), pytest + pytest-django (already configured), SQLite dev database. Full spec: `docs/superpowers/specs/2026-07-31-trabalhadores-diarias-design.md`.

## Global Constraints

- Every model that is a user's own data must carry `usuario` directly or inherit it via a FK chain up to a `usuario`-owned model (ADR 002). `Trabalhador.usuario` is direct (same pattern as `Insumo.usuario`); `Diaria` inherits tenant scoping via `trabalhador.usuario` (and independently via `plantio -> talhao -> propriedade -> usuario`).
- Money fields use `DecimalField(max_digits=10, decimal_places=2)`, never `FloatField` (ADR/pattern already established for `valor`, `area`, `quantidade` elsewhere).
- `Diaria.trabalhador` and `Diaria.plantio` are `on_delete=models.PROTECT` (ADR 007 pattern: don't let deleting a catalog/reference row silently erase a financial/audit record — use `Trabalhador.ativo=False` or `Plantio.status="cancelado"` instead).
- `Diaria.valor` is a **frozen snapshot** of `trabalhador.valor_diaria` taken at creation time, not a live reference — implemented via a `save()` override that fills `valor` from the trabalhador only when the `Diaria` is being created (`self._state.adding`) and `valor` wasn't explicitly passed.
- `Diaria.lancamento` is `null=True, blank=True` (unpaid diárias have no lançamento yet) and `on_delete=models.PROTECT` (once a diária is paid, deleting that `LancamentoFinanceiro` must not be allowed to silently "unpay" it).
- One diária per (`trabalhador`, `data`) — enforced via `models.UniqueConstraint`, not a plain `unique_together` tuple (Django's current recommended API).
- Test files live under `lagoagro/tests/`, not per-app `tests.py`. This plan creates one new file: `lagoagro/tests/test_finance_trabalhadores_diarias.py`, mirroring the `_criar_plantio_e_usuario()` local helper pattern already used in `lagoagro/tests/test_inputs_models.py`.
- `ProtectedError` comes from `django.db.models.deletion.ProtectedError` (see existing import in `test_inputs_models.py`).
- Register every new model in `finance/admin.py` with a plain `admin.site.register(Model)`.
- Run `uv run python manage.py makemigrations finance && uv run python manage.py migrate` at the end of each task, from `lagoagro/`. Commit the migration file(s) together with the model change in the same commit.
- All commands in this plan assume the working directory is `lagoagro/` and use `uv run pytest` / `uv run python manage.py ...`.
- Conventional Commits: scope `finance` for all commits in this plan.

---

### Task 1: `Trabalhador` model

**Files:**
- Create: `lagoagro/tests/test_finance_trabalhadores_diarias.py`
- Modify: `lagoagro/finance/models.py`
- Modify: `lagoagro/finance/admin.py`
- Create (generated): `lagoagro/finance/migrations/0003_trabalhador.py`

**Interfaces:**
- Consumes: `settings.AUTH_USER_MODEL` (Django built-in), same as `inputs.Insumo.usuario`.
- Produces: `finance.models.Trabalhador` with fields `usuario` (FK), `nome` (CharField), `valor_diaria` (DecimalField), `ativo` (BooleanField, default `True`). Task 2 imports this class from `finance.models`.

- [ ] **Step 1: Write the failing test**

```python
# lagoagro/tests/test_finance_trabalhadores_diarias.py
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError

from crops.models import Cultura
from finance.models import Trabalhador
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def _criar_plantio_e_usuario():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    return usuario, plantio


def test_trabalhador_pertence_a_um_usuario_e_comeca_ativo():
    usuario, _ = _criar_plantio_e_usuario()

    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    assert trabalhador.usuario == usuario
    assert trabalhador.valor_diaria == Decimal("120.00")
    assert trabalhador.ativo is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_finance_trabalhadores_diarias.py -v`
Expected: FAIL with `ImportError: cannot import name 'Trabalhador' from 'finance.models'`

- [ ] **Step 3: Write minimal implementation**

In `lagoagro/finance/models.py`, add `from django.conf import settings` to the imports at the top, then add the new model (keep `LancamentoFinanceiro` as-is, add this class either before or after it — before is clearer since `Diaria` in Task 2 will reference both `Trabalhador` and `LancamentoFinanceiro`):

```python
class Trabalhador(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trabalhadores")
    nome = models.CharField(max_length=100)
    valor_diaria = models.DecimalField(max_digits=10, decimal_places=2)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return self.nome
```

- [ ] **Step 4: Register in admin**

In `lagoagro/finance/admin.py`:

```python
from django.contrib import admin

from .models import LancamentoFinanceiro, Trabalhador

admin.site.register(LancamentoFinanceiro)
admin.site.register(Trabalhador)
```

- [ ] **Step 5: Generate and apply the migration**

Run (from `lagoagro/`):
```bash
uv run python manage.py makemigrations finance
uv run python manage.py migrate
```
Expected: creates `finance/migrations/0003_trabalhador.py`, applies cleanly.

- [ ] **Step 6: Run test to verify it passes**

Run: `uv run pytest tests/test_finance_trabalhadores_diarias.py -v`
Expected: PASS (1 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (44 — 43 existing + 1 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/finance/models.py lagoagro/finance/admin.py lagoagro/finance/migrations/0003_trabalhador.py lagoagro/tests/test_finance_trabalhadores_diarias.py
git commit -m "feat(finance): adicionar model Trabalhador"
```

---

### Task 2: `Diaria` model

**Files:**
- Modify: `lagoagro/finance/models.py`
- Modify: `lagoagro/finance/admin.py`
- Modify: `lagoagro/tests/test_finance_trabalhadores_diarias.py`
- Create (generated): `lagoagro/finance/migrations/0004_diaria.py`

**Interfaces:**
- Consumes: `finance.models.Trabalhador` (Task 1), `plantings.models.Plantio` (existing), `finance.models.LancamentoFinanceiro` (existing).
- Produces: `finance.models.Diaria` with fields `trabalhador` (FK, PROTECT), `plantio` (FK, PROTECT), `data` (DateField), `valor` (DecimalField, auto-snapshotted on create), `lancamento` (FK, nullable, PROTECT). `UniqueConstraint` named `unique_diaria_por_trabalhador_e_dia` on (`trabalhador`, `data`). Task 3 imports `Diaria` and filters on `lancamento__isnull=True`.

- [ ] **Step 1: Write the failing tests**

Append to `lagoagro/tests/test_finance_trabalhadores_diarias.py` (add `from django.db import IntegrityError` and `from finance.models import Diaria, Trabalhador` — update the existing `finance.models` import line to include `Diaria`):

```python
from django.db import IntegrityError
```

```python
def test_diaria_congela_valor_do_trabalhador_no_momento_da_criacao():
    usuario, plantio = _criar_plantio_e_usuario()
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    diaria = Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")

    assert diaria.valor == Decimal("120.00")

    trabalhador.valor_diaria = Decimal("150.00")
    trabalhador.save()
    diaria.refresh_from_db()

    assert diaria.valor == Decimal("120.00")  # nao muda com o reajuste


def test_diaria_duplicada_no_mesmo_dia_para_o_mesmo_trabalhador_falha():
    usuario, plantio = _criar_plantio_e_usuario()
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")

    with pytest.raises(IntegrityError):
        Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")


def test_deletar_trabalhador_com_diaria_e_protegido():
    usuario, plantio = _criar_plantio_e_usuario()
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")

    with pytest.raises(ProtectedError):
        trabalhador.delete()


def test_deletar_plantio_com_diaria_e_protegido():
    usuario, plantio = _criar_plantio_e_usuario()
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")

    with pytest.raises(ProtectedError):
        plantio.delete()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_finance_trabalhadores_diarias.py -v`
Expected: FAIL — `ImportError: cannot import name 'Diaria' from 'finance.models'` (all 4 new tests error out on collection)

- [ ] **Step 3: Write minimal implementation**

In `lagoagro/finance/models.py`, add the `Diaria` model after `Trabalhador` (and before or after `LancamentoFinanceiro` — it references it, so Python needs `LancamentoFinanceiro` defined first, or use the lazy string `"finance.LancamentoFinanceiro"`; use the lazy string form so ordering in the file doesn't matter, consistent with the cross-app FK style already used for `plantio`):

```python
class Diaria(models.Model):
    trabalhador = models.ForeignKey(Trabalhador, on_delete=models.PROTECT, related_name="diarias")
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.PROTECT, related_name="diarias")
    data = models.DateField()
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    lancamento = models.ForeignKey(
        "finance.LancamentoFinanceiro",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="diarias_pagas",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["trabalhador", "data"], name="unique_diaria_por_trabalhador_e_dia")
        ]

    def save(self, *args, **kwargs):
        if self._state.adding and self.valor is None:
            self.valor = self.trabalhador.valor_diaria
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.trabalhador.nome} - {self.data}"
```

- [ ] **Step 4: Register in admin**

In `lagoagro/finance/admin.py`:

```python
from django.contrib import admin

from .models import Diaria, LancamentoFinanceiro, Trabalhador

admin.site.register(LancamentoFinanceiro)
admin.site.register(Trabalhador)
admin.site.register(Diaria)
```

- [ ] **Step 5: Generate and apply the migration**

Run (from `lagoagro/`):
```bash
uv run python manage.py makemigrations finance
uv run python manage.py migrate
```
Expected: creates `finance/migrations/0004_diaria.py` with a `CreateModel` for `Diaria` and its `UniqueConstraint`, applies cleanly. No interactive prompt expected here (unlike the earlier `setor` field, this is a brand-new table, not an added column on an existing one).

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_finance_trabalhadores_diarias.py -v`
Expected: PASS (5 passed — 1 from Task 1 + 4 new)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (48 — 43 existing + 5)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/finance/models.py lagoagro/finance/admin.py lagoagro/finance/migrations/0004_diaria.py lagoagro/tests/test_finance_trabalhadores_diarias.py
git commit -m "feat(finance): adicionar model Diaria com valor congelado e protecao de exclusao"
```

---

### Task 3: `pagar_diarias_pendentes` service function

**Files:**
- Create: `lagoagro/finance/services.py`
- Modify: `lagoagro/tests/test_finance_trabalhadores_diarias.py`

**Interfaces:**
- Consumes: `finance.models.Diaria`, `finance.models.LancamentoFinanceiro`, `finance.models.Trabalhador` (Tasks 1-2).
- Produces: `finance.services.pagar_diarias_pendentes(trabalhador: Trabalhador) -> list[LancamentoFinanceiro]`. This is the function the future DRF endpoint (Task #6 of the overall project) will call — no view/serializer/URL is created in this plan.

- [ ] **Step 1: Write the failing tests**

Append to `lagoagro/tests/test_finance_trabalhadores_diarias.py`. Add this import line near the top (alongside the others):

```python
from finance.services import pagar_diarias_pendentes
```

```python
def test_pagar_diarias_pendentes_agrupa_por_plantio_um_plantio():
    usuario, plantio = _criar_plantio_e_usuario()
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-02")
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-03")

    lancamentos = pagar_diarias_pendentes(trabalhador)

    assert len(lancamentos) == 1
    assert lancamentos[0].valor == Decimal("360.00")
    assert lancamentos[0].setor == "mao_de_obra"
    assert lancamentos[0].plantio == plantio
    assert Diaria.objects.filter(trabalhador=trabalhador, lancamento__isnull=True).count() == 0


def test_pagar_diarias_pendentes_agrupa_por_plantio_dois_plantios():
    usuario, plantio1 = _criar_plantio_e_usuario()
    talhao2 = Talhao.objects.create(
        propriedade=plantio1.talhao.propriedade, nome="Talhao 2", area=Decimal("1.00"), tipo_solo="arenoso"
    )
    cultura2 = Cultura.objects.create(nome="Tomate", ciclo_dias=80)
    plantio2 = Plantio.objects.create(talhao=talhao2, cultura=cultura2, data_plantio="2026-01-05")
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("100.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio1, data="2026-02-01")
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio2, data="2026-02-02")

    lancamentos = pagar_diarias_pendentes(trabalhador)

    assert len(lancamentos) == 2
    valores_por_plantio = {l.plantio_id: l.valor for l in lancamentos}
    assert valores_por_plantio[plantio1.id] == Decimal("100.00")
    assert valores_por_plantio[plantio2.id] == Decimal("100.00")


def test_pagar_diarias_pendentes_sem_pendencias_retorna_lista_vazia():
    usuario, _ = _criar_plantio_e_usuario()
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    lancamentos = pagar_diarias_pendentes(trabalhador)

    assert lancamentos == []
    assert LancamentoFinanceiro.objects.count() == 0
```

Note: this last test needs `LancamentoFinanceiro` importable — add it to the existing `from finance.models import ...` import line.

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_finance_trabalhadores_diarias.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'finance.services'`

- [ ] **Step 3: Write minimal implementation**

```python
# lagoagro/finance/services.py
from django.db.models import Max, Min, Sum
from django.utils import timezone

from .models import Diaria, LancamentoFinanceiro


def pagar_diarias_pendentes(trabalhador):
    diarias_pendentes = Diaria.objects.filter(trabalhador=trabalhador, lancamento__isnull=True)
    plantio_ids_pendentes = diarias_pendentes.values_list("plantio_id", flat=True).distinct()

    lancamentos_criados = []
    for plantio_id in plantio_ids_pendentes:
        diarias_do_plantio = diarias_pendentes.filter(plantio_id=plantio_id)
        agregado = diarias_do_plantio.aggregate(total=Sum("valor"), inicio=Min("data"), fim=Max("data"))

        lancamento = LancamentoFinanceiro.objects.create(
            plantio_id=plantio_id,
            valor=agregado["total"],
            data=timezone.localdate(),
            descricao=(
                f"Pagamento de diárias - {trabalhador.nome} "
                f"({agregado['inicio']:%d/%m/%Y} a {agregado['fim']:%d/%m/%Y})"
            ),
            setor="mao_de_obra",
        )
        diarias_do_plantio.update(lancamento=lancamento)
        lancamentos_criados.append(lancamento)

    return lancamentos_criados
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_finance_trabalhadores_diarias.py -v`
Expected: PASS (8 passed — 5 from Tasks 1-2 + 3 new)

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (51 — 43 existing + 8)

- [ ] **Step 6: Commit**

```bash
git add lagoagro/finance/services.py lagoagro/tests/test_finance_trabalhadores_diarias.py
git commit -m "feat(finance): adicionar pagar_diarias_pendentes agrupando por plantio"
```

---

## Post-plan note

This plan only covers models + service layer. Wiring `pagar_diarias_pendentes` (and CRUD for `Trabalhador`/`Diaria`) to an HTTP endpoint happens in the overall project's Task #6 (Serializers/views/permissions DRF por app), together with the multi-tenant queryset filtering from Task #5 (Auth JWT) — a `Trabalhador`/`Diaria` view must filter by the authenticated user the same way every other app's views will.

**Cross-FK tenant consistency (flagged by the final whole-branch review):** `Diaria` sits at the junction of two independent tenant chains — `trabalhador.usuario` and `plantio.talhao.propriedade.usuario`. Per-model queryset filtering (each FK's queryset scoped to `request.user`) is not enough on its own: nothing stops a `Diaria` referencing a `trabalhador` and a `plantio` that belong to *different* users if the write path doesn't explicitly check both chains agree. Task #6's serializer/view for `Diaria` must validate `diaria.trabalhador.usuario == diaria.plantio.talhao.propriedade.usuario` (e.g. in the serializer's `validate()`) in addition to filtering each FK's queryset by the authenticated user — the same rule applies if `pagar_diarias_pendentes` is ever called with a plantio/trabalhador pair from different accounts.
