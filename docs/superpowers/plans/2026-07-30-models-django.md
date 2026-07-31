# Models Django das Entidades Principais - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Django ORM models for the 10 core entities of LagoAgro (Propriedade, Talhao, Cultura, FaseCultura, Insumo, AplicacaoInsumo, Plantio, Tarefa, Colheita, LancamentoFinanceiro) across the 7 already-scaffolded apps, test-driven, respecting the multi-tenant structure from ADR 002.

**Architecture:** Each app owns its own `models.py`. Cross-app foreign keys use Django's lazy string reference (`"app_label.ModelName"`) to avoid import-order coupling. Tasks execute strictly in dependency order (properties, crops -> plantings -> inputs, tasks/harvest/finance) because Django migrations need a referenced app's migration to exist on disk before a migration that references it can be generated.

**Tech Stack:** Django 6.0 (already installed), pytest + pytest-django (already configured, `DJANGO_SETTINGS_MODULE = core.settings`), SQLite dev database (already migrated for built-in apps).

## Global Constraints

- Every model that is a user's own data must carry `usuario` directly or inherit it via a FK chain up to a `usuario`-owned model (ADR 002). Exception: `Cultura` and `FaseCultura` are a shared reference catalog (pimentao/tomate/batata in the MVP), not per-user data - no `usuario` field on these two, by design (see Task 2 notes).
- Use `settings.AUTH_USER_MODEL` (Django's built-in `django.contrib.auth.models.User`) for every user FK - no custom Usuario model, since no extra fields beyond auth were ever requested (RF13 only asks for authentication + data isolation).
- Money and area fields use `DecimalField`, never `FloatField` (binary floating point loses precision on currency/area math).
- `AplicacaoInsumo` carries `created_by` and `created_at` as an immutable audit trail (threat-model.md, Repudiation mitigation) - these are set once at creation and never updated by application code.
- Every test file lives under `tests/` (existing pytest convention from the domain/ work), not the per-app `tests.py` Django scaffolds by default - delete each app's generated `tests.py` stub the first time that app is touched.
- Register every model in its app's `admin.py` with a plain `admin.site.register(Model)` - ADR 004's stated reason for choosing Django is "admin pronto para cadastro rapido de culturas/insumos"; this is config, not behavior, so it does not need its own red/green cycle.
- Run `uv run python manage.py makemigrations <app> && uv run python manage.py migrate` at the end of each task, from `lagoagro/`. Commit the migration file(s) together with the model change in the same commit.
- Test commands in this plan assume the working directory is `lagoagro/` and use `uv run pytest`.

---

### Task 1: properties (Propriedade, Talhao)

**Files:**
- Create: `lagoagro/tests/test_properties_models.py`
- Modify: `lagoagro/properties/models.py`
- Modify: `lagoagro/properties/admin.py`
- Delete: `lagoagro/properties/tests.py`
- Create (generated): `lagoagro/properties/migrations/0001_initial.py`

**Interfaces:**
- Consumes: `settings.AUTH_USER_MODEL` (Django built-in).
- Produces: `properties.models.Propriedade` (fields: `usuario` FK, `nome` CharField), `properties.models.Talhao` (fields: `propriedade` FK to `Propriedade`, `nome` CharField, `area` DecimalField, `tipo_solo` CharField). Later tasks import both by class from `properties.models`.

- [ ] **Step 1: Delete the unused Django-generated test stub**

```bash
rm lagoagro/properties/tests.py
```

- [ ] **Step 2: Write the failing tests**

```python
# lagoagro/tests/test_properties_models.py
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def test_propriedade_pertence_a_um_usuario():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")

    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    assert propriedade.usuario == usuario
    assert str(propriedade) == "Sitio Boa Vista"


def test_talhao_pertence_a_uma_propriedade():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    # Passa Decimal direto (nao string): Django nao converte o atributo Python
    # em memoria ao salvar, so o valor gravado no banco - comparar contra uma
    # string ou float exigiria reler do banco (refresh_from_db). Decimal("2.50")
    # ja e o proprio tipo do campo, entao a comparacao abaixo funciona sem isso.
    talhao = Talhao.objects.create(
        propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso"
    )

    assert talhao.propriedade == propriedade
    assert talhao.area == Decimal("2.50")


def test_deletar_propriedade_deleta_talhoes_em_cascata():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area="2.50", tipo_solo="argiloso")

    propriedade.delete()

    assert Talhao.objects.count() == 0
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_properties_models.py -v`
Expected: FAIL / ERROR - `ImportError: cannot import name 'Propriedade' from 'properties.models'` (models.py is still the empty Django stub)

- [ ] **Step 4: Write the minimal model implementation**

```python
# lagoagro/properties/models.py
from django.conf import settings
from django.db import models


class Propriedade(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="propriedades"
    )
    nome = models.CharField(max_length=100)

    def __str__(self):
        return self.nome


class Talhao(models.Model):
    propriedade = models.ForeignKey(Propriedade, on_delete=models.CASCADE, related_name="talhoes")
    nome = models.CharField(max_length=100)
    area = models.DecimalField(max_digits=10, decimal_places=2)  # hectares
    tipo_solo = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.nome} ({self.propriedade.nome})"
```

```python
# lagoagro/properties/admin.py
from django.contrib import admin

from .models import Propriedade, Talhao

admin.site.register(Propriedade)
admin.site.register(Talhao)
```

- [ ] **Step 5: Generate and apply migrations**

Run: `uv run python manage.py makemigrations properties && uv run python manage.py migrate`
Expected: creates and applies `properties/migrations/0001_initial.py`

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_properties_models.py -v`
Expected: PASS (3/3)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/properties lagoagro/tests/test_properties_models.py
git commit -m "feat(properties): adicionar models Propriedade e Talhao"
```

---

### Task 2: crops (Cultura, FaseCultura)

**Files:**
- Create: `lagoagro/tests/test_crops_models.py`
- Modify: `lagoagro/crops/models.py`
- Modify: `lagoagro/crops/admin.py`
- Delete: `lagoagro/crops/tests.py`
- Create (generated): `lagoagro/crops/migrations/0001_initial.py`

**Interfaces:**
- Consumes: nothing from other apps.
- Produces: `crops.models.Cultura` (fields: `nome` CharField unique, `ciclo_dias` PositiveIntegerField), `crops.models.FaseCultura` (fields: `cultura` FK, `nome_fase` CharField, `dia_inicio`/`dia_fim` PositiveIntegerField, `Meta.ordering = ["dia_inicio"]`). Task 3 imports `Cultura` from `crops.models`. This shape (`dia_inicio`/`dia_fim`, not a duration) matches exactly what `domain/cycle_calc.py::fase_atual` already expects.

- [ ] **Step 1: Delete the unused Django-generated test stub**

```bash
rm lagoagro/crops/tests.py
```

- [ ] **Step 2: Write the failing tests**

```python
# lagoagro/tests/test_crops_models.py
import pytest

from crops.models import Cultura, FaseCultura

pytestmark = pytest.mark.django_db


def test_cultura_e_catalogo_compartilhado_sem_usuario():
    # Cultura nao tem usuario_id: e catalogo de referencia (pimentao, tomate,
    # batata no MVP), nao dado pertencente a um usuario - excecao deliberada
    # ao ADR 002, que exige usuario_id em dado de dominio do usuario.
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    assert not hasattr(cultura, "usuario")
    assert str(cultura) == "Pimentao"


def test_fase_cultura_pertence_a_uma_cultura_com_intervalo_de_dias():
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    fase = FaseCultura.objects.create(cultura=cultura, nome_fase="muda", dia_inicio=0, dia_fim=20)

    assert fase.cultura == cultura
    assert fase.dia_inicio == 0
    assert fase.dia_fim == 20


def test_fases_sao_ordenadas_por_dia_inicio():
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=cultura, nome_fase="floracao", dia_inicio=21, dia_fim=45)
    FaseCultura.objects.create(cultura=cultura, nome_fase="muda", dia_inicio=0, dia_fim=20)

    nomes = list(cultura.fases.values_list("nome_fase", flat=True))

    assert nomes == ["muda", "floracao"]
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_crops_models.py -v`
Expected: FAIL / ERROR - `ImportError: cannot import name 'Cultura' from 'crops.models'`

- [ ] **Step 4: Write the minimal model implementation**

```python
# lagoagro/crops/models.py
from django.db import models


class Cultura(models.Model):
    nome = models.CharField(max_length=100, unique=True)
    ciclo_dias = models.PositiveIntegerField()

    def __str__(self):
        return self.nome


class FaseCultura(models.Model):
    cultura = models.ForeignKey(Cultura, on_delete=models.CASCADE, related_name="fases")
    nome_fase = models.CharField(max_length=100)
    dia_inicio = models.PositiveIntegerField()
    dia_fim = models.PositiveIntegerField()

    class Meta:
        ordering = ["dia_inicio"]

    def __str__(self):
        return f"{self.cultura.nome} - {self.nome_fase}"
```

```python
# lagoagro/crops/admin.py
from django.contrib import admin

from .models import Cultura, FaseCultura

admin.site.register(Cultura)
admin.site.register(FaseCultura)
```

- [ ] **Step 5: Generate and apply migrations**

Run: `uv run python manage.py makemigrations crops && uv run python manage.py migrate`

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_crops_models.py -v`
Expected: PASS (3/3)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/crops lagoagro/tests/test_crops_models.py
git commit -m "feat(crops): adicionar models Cultura e FaseCultura"
```

---

### Task 3: plantings (Plantio)

**Files:**
- Create: `lagoagro/tests/test_plantings_models.py`
- Modify: `lagoagro/plantings/models.py`
- Modify: `lagoagro/plantings/admin.py`
- Delete: `lagoagro/plantings/tests.py`
- Create (generated): `lagoagro/plantings/migrations/0001_initial.py`

**Interfaces:**
- Consumes: `properties.models.Talhao` (Task 1), `crops.models.Cultura` (Task 2) - referenced as `"properties.Talhao"` / `"crops.Cultura"` string FKs, not direct imports, to avoid cross-app import coupling.
- Produces: `plantings.models.Plantio` (fields: `talhao` FK CASCADE, `cultura` FK PROTECT, `data_plantio` DateField, `status` CharField with choices, default `"em_andamento"`). Tasks 4 and 5 reference it as `"plantings.Plantio"`.

- [ ] **Step 1: Delete the unused Django-generated test stub**

```bash
rm lagoagro/plantings/tests.py
```

- [ ] **Step 2: Write the failing tests**

```python
# lagoagro/tests/test_plantings_models.py
import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError

from crops.models import Cultura
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def _criar_talhao():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    return Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area="2.50", tipo_solo="argiloso")


def test_plantio_liga_talhao_e_cultura_com_status_padrao():
    talhao = _criar_talhao()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    assert plantio.talhao == talhao
    assert plantio.cultura == cultura
    assert plantio.status == "em_andamento"


def test_deletar_talhao_deleta_plantio_em_cascata():
    talhao = _criar_talhao()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    talhao.delete()

    assert Plantio.objects.count() == 0


def test_deletar_cultura_em_uso_por_plantio_e_protegido():
    # Cultura e catalogo compartilhado (Task 2) - nao pode sumir silenciosamente
    # e arrastar plantios historicos junto.
    talhao = _criar_talhao()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    with pytest.raises(ProtectedError):
        cultura.delete()
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_plantings_models.py -v`
Expected: FAIL / ERROR - `ImportError: cannot import name 'Plantio' from 'plantings.models'`

- [ ] **Step 4: Write the minimal model implementation**

```python
# lagoagro/plantings/models.py
from django.db import models


class Plantio(models.Model):
    STATUS_CHOICES = [
        ("em_andamento", "Em andamento"),
        ("colhido", "Colhido"),
        ("cancelado", "Cancelado"),
    ]

    talhao = models.ForeignKey("properties.Talhao", on_delete=models.CASCADE, related_name="plantios")
    cultura = models.ForeignKey("crops.Cultura", on_delete=models.PROTECT, related_name="plantios")
    data_plantio = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="em_andamento")

    def __str__(self):
        return f"{self.cultura.nome} em {self.talhao.nome} ({self.data_plantio})"
```

```python
# lagoagro/plantings/admin.py
from django.contrib import admin

from .models import Plantio

admin.site.register(Plantio)
```

- [ ] **Step 5: Generate and apply migrations**

Run: `uv run python manage.py makemigrations plantings && uv run python manage.py migrate`

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_plantings_models.py -v`
Expected: PASS (3/3)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/plantings lagoagro/tests/test_plantings_models.py
git commit -m "feat(plantings): adicionar model Plantio"
```

---

### Task 4: inputs (Insumo, AplicacaoInsumo)

**Files:**
- Create: `lagoagro/tests/test_inputs_models.py`
- Modify: `lagoagro/inputs/models.py`
- Modify: `lagoagro/inputs/admin.py`
- Delete: `lagoagro/inputs/tests.py`
- Create (generated): `lagoagro/inputs/migrations/0001_initial.py`

**Interfaces:**
- Consumes: `plantings.models.Plantio` (Task 3, referenced as `"plantings.Plantio"` string FK), `settings.AUTH_USER_MODEL`.
- Produces: `inputs.models.Insumo` (fields: `usuario` FK, `nome`, `tipo` choices `veneno`/`adubo`, `carencia_dias`), `inputs.models.AplicacaoInsumo` (fields: `plantio` FK CASCADE, `insumo` FK PROTECT, `data`, `quantidade`, `created_by` FK PROTECT, `created_at` auto_now_add). No other task consumes these.

- [ ] **Step 1: Delete the unused Django-generated test stub**

```bash
rm lagoagro/inputs/tests.py
```

- [ ] **Step 2: Write the failing tests**

```python
# lagoagro/tests/test_inputs_models.py
import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError

from crops.models import Cultura
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def _criar_plantio_e_usuario():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area="2.50", tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    return usuario, plantio


def test_insumo_pertence_a_um_usuario_e_tem_carencia():
    usuario, _ = _criar_plantio_e_usuario()

    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    assert insumo.usuario == usuario
    assert insumo.carencia_dias == 7


def test_aplicacao_registra_quem_e_quando_criou():
    usuario, plantio = _criar_plantio_e_usuario()
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    aplicacao = AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade="1.50", created_by=usuario
    )

    assert aplicacao.created_by == usuario
    assert aplicacao.created_at is not None


def test_deletar_insumo_em_uso_e_protegido():
    usuario, plantio = _criar_plantio_e_usuario()
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade="1.50", created_by=usuario
    )

    with pytest.raises(ProtectedError):
        insumo.delete()


def test_deletar_plantio_deleta_aplicacoes_em_cascata():
    usuario, plantio = _criar_plantio_e_usuario()
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade="1.50", created_by=usuario
    )

    plantio.delete()

    assert AplicacaoInsumo.objects.count() == 0
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_inputs_models.py -v`
Expected: FAIL / ERROR - `ImportError: cannot import name 'Insumo' from 'inputs.models'`

- [ ] **Step 4: Write the minimal model implementation**

```python
# lagoagro/inputs/models.py
from django.conf import settings
from django.db import models


class Insumo(models.Model):
    TIPO_CHOICES = [
        ("veneno", "Veneno"),
        ("adubo", "Adubo"),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="insumos"
    )
    nome = models.CharField(max_length=100)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    carencia_dias = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.nome


class AplicacaoInsumo(models.Model):
    # created_by/created_at: trilha de auditoria imutavel (threat-model.md,
    # mitigacao de Repudiation) - nao sao alterados depois de criados.
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="aplicacoes")
    insumo = models.ForeignKey(Insumo, on_delete=models.PROTECT, related_name="aplicacoes")
    data = models.DateField()
    quantidade = models.DecimalField(max_digits=10, decimal_places=2)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="aplicacoes_registradas"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.insumo.nome} em {self.plantio} ({self.data})"
```

```python
# lagoagro/inputs/admin.py
from django.contrib import admin

from .models import AplicacaoInsumo, Insumo

admin.site.register(Insumo)
admin.site.register(AplicacaoInsumo)
```

- [ ] **Step 5: Generate and apply migrations**

Run: `uv run python manage.py makemigrations inputs && uv run python manage.py migrate`

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_inputs_models.py -v`
Expected: PASS (4/4)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/inputs lagoagro/tests/test_inputs_models.py
git commit -m "feat(inputs): adicionar models Insumo e AplicacaoInsumo"
```

---

### Task 5: tasks, harvest, finance (Tarefa, Colheita, LancamentoFinanceiro)

**Files:**
- Create: `lagoagro/tests/test_tarefas_colheitas_financeiro_models.py`
- Modify: `lagoagro/tasks/models.py`, `lagoagro/tasks/admin.py`
- Modify: `lagoagro/harvest/models.py`, `lagoagro/harvest/admin.py`
- Modify: `lagoagro/finance/models.py`, `lagoagro/finance/admin.py`
- Delete: `lagoagro/tasks/tests.py`, `lagoagro/harvest/tests.py`, `lagoagro/finance/tests.py`
- Create (generated): `lagoagro/tasks/migrations/0001_initial.py`, `lagoagro/harvest/migrations/0001_initial.py`, `lagoagro/finance/migrations/0001_initial.py`

**Interfaces:**
- Consumes: `plantings.models.Plantio` (Task 3, referenced as `"plantings.Plantio"` string FK) in all three models.
- Produces: `tasks.models.Tarefa` (fields: `plantio` FK, `descricao`, `data`, `concluida` default `False`), `harvest.models.Colheita` (fields: `plantio` FK, `data`, `classificacao` choices `primeira`/`segunda` - MVP scope only, see note below, `quantidade`), `finance.models.LancamentoFinanceiro` (fields: `plantio` FK, `valor`, `data`, `descricao`). No later task consumes these - this is the last task in the plan.
- Note: `requirements.md` section 6 leaves "classificacoes de colheita alem de primeira/segunda variam por cultura?" as an explicitly open question for future revision - do NOT design a per-cultura classification scheme now; the fixed two-choice field matches what's actually validated with the user today.

- [ ] **Step 1: Delete the unused Django-generated test stubs**

```bash
rm lagoagro/tasks/tests.py lagoagro/harvest/tests.py lagoagro/finance/tests.py
```

- [ ] **Step 2: Write the failing tests**

```python
# lagoagro/tests/test_tarefas_colheitas_financeiro_models.py
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from crops.models import Cultura
from finance.models import LancamentoFinanceiro
from harvest.models import Colheita
from plantings.models import Plantio
from properties.models import Propriedade, Talhao
from tasks.models import Tarefa

pytestmark = pytest.mark.django_db


def _criar_plantio():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_tarefa_pertence_a_um_plantio_e_comeca_nao_concluida():
    plantio = _criar_plantio()

    tarefa = Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data="2026-02-01")

    assert tarefa.plantio == plantio
    assert tarefa.concluida is False


def test_colheita_registra_classificacao_e_quantidade():
    plantio = _criar_plantio()

    # Decimal direto na criacao (nao string) - ver nota em test_properties_models.py
    # sobre por que comparar contra int/float exigiria refresh_from_db().
    colheita = Colheita.objects.create(
        plantio=plantio, data="2026-04-01", classificacao="primeira", quantidade=Decimal("50.00")
    )

    assert colheita.classificacao == "primeira"
    assert colheita.quantidade == Decimal("50.00")


def test_lancamento_financeiro_pertence_a_um_plantio():
    plantio = _criar_plantio()

    lancamento = LancamentoFinanceiro.objects.create(
        plantio=plantio, valor=Decimal("150.00"), data="2026-01-15", descricao="Compra de mudas"
    )

    assert lancamento.plantio == plantio
    assert lancamento.valor == Decimal("150.00")


def test_deletar_plantio_deleta_tarefas_colheitas_e_lancamentos_em_cascata():
    plantio = _criar_plantio()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data="2026-02-01")
    Colheita.objects.create(plantio=plantio, data="2026-04-01", classificacao="primeira", quantidade="50.00")
    LancamentoFinanceiro.objects.create(plantio=plantio, valor="150.00", data="2026-01-15", descricao="Compra de mudas")

    plantio.delete()

    assert Tarefa.objects.count() == 0
    assert Colheita.objects.count() == 0
    assert LancamentoFinanceiro.objects.count() == 0
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_tarefas_colheitas_financeiro_models.py -v`
Expected: FAIL / ERROR - `ImportError: cannot import name 'Tarefa' from 'tasks.models'`

- [ ] **Step 4: Write the minimal model implementation**

```python
# lagoagro/tasks/models.py
from django.db import models


class Tarefa(models.Model):
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="tarefas")
    descricao = models.CharField(max_length=255)
    data = models.DateField()
    concluida = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.descricao} ({self.data})"
```

```python
# lagoagro/tasks/admin.py
from django.contrib import admin

from .models import Tarefa

admin.site.register(Tarefa)
```

```python
# lagoagro/harvest/models.py
from django.db import models


class Colheita(models.Model):
    CLASSIFICACAO_CHOICES = [
        ("primeira", "Primeira"),
        ("segunda", "Segunda"),
    ]

    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="colheitas")
    data = models.DateField()
    classificacao = models.CharField(max_length=20, choices=CLASSIFICACAO_CHOICES)
    quantidade = models.DecimalField(max_digits=10, decimal_places=2)  # caixas

    def __str__(self):
        return f"{self.classificacao} - {self.quantidade} ({self.plantio})"
```

```python
# lagoagro/harvest/admin.py
from django.contrib import admin

from .models import Colheita

admin.site.register(Colheita)
```

```python
# lagoagro/finance/models.py
from django.db import models


class LancamentoFinanceiro(models.Model):
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="lancamentos")
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    descricao = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.descricao}: {self.valor} ({self.data})"
```

```python
# lagoagro/finance/admin.py
from django.contrib import admin

from .models import LancamentoFinanceiro

admin.site.register(LancamentoFinanceiro)
```

- [ ] **Step 5: Generate and apply migrations**

Run: `uv run python manage.py makemigrations tasks harvest finance && uv run python manage.py migrate`

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_tarefas_colheitas_financeiro_models.py -v`
Expected: PASS (4/4)

- [ ] **Step 7: Run the full suite to confirm nothing else broke**

Run: `uv run pytest -v`
Expected: PASS (all tests: 19 domain + this plan's new model tests)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/tasks lagoagro/harvest lagoagro/finance lagoagro/tests/test_tarefas_colheitas_financeiro_models.py
git commit -m "feat(tasks,harvest,finance): adicionar models Tarefa, Colheita e LancamentoFinanceiro"
```
