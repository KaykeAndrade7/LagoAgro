# Job de Notificação Diária + Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the backend capability behind RF11 (notificar o usuário no dia da tarefa): a `PushSubscription` model + registration API, an idempotent notification-sending service, an HTTP trigger endpoint protected by a shared secret, and a management command — all testable in isolation, with no real VAPID keys or cron wiring (that's Task #9/Deploy).

**Architecture:** New `notifications` app, following the same `UsuarioScopedQuerySetMixin` + FK-scoped-serializer pattern used by every other app (see `docs/superpowers/specs/2026-07-31-drf-viewsets-por-app-design.md`). A single service function (`notifications/services.py::enviar_notificacoes_do_dia`) contains all the sending logic; both the management command and the secret-protected `APIView` call it — no duplicated logic between the two trigger paths. `pywebpush` is used directly (no `django-webpush`) so the project keeps full control of the model/serializer/view shape. `Tarefa` gains a `notificado_em` field so the job is safe to run more than once on the same day.

**Tech Stack:** Django 6.0, DRF, `pywebpush` (new dependency), pytest + pytest-django, SQLite dev DB. Full spec: `docs/superpowers/specs/2026-08-01-notificacoes-push-design.md`.

## Global Constraints

- `PushSubscription.endpoint` is globally unique; registering an already-known endpoint must `update_or_create` (reassigning `usuario` if a different account posts the same endpoint), never raise a uniqueness error or create a duplicate row.
- The trigger endpoint (`POST /api/notificacoes/disparar/`) has no JWT auth (`authentication_classes = []`, `AllowAny`) — it's called by an external cron, not a logged-in user — and is guarded only by an `X-Notification-Secret` header checked with `secrets.compare_digest`, never `==`.
- The trigger endpoint **fails closed**: if `settings.NOTIFICATION_TRIGGER_SECRET` is empty (unset), every request is rejected with 403 — it must never fall back to "no secret configured = allow".
- `enviar_notificacoes_do_dia()` only deletes a `PushSubscription` when the push service responds 404/410 (permanently gone); any other error leaves the subscription alone.
- A `Tarefa` is only eligible for notification if `data == hoje` and (`notificado_em` is null or its date is before `hoje`) — this is what makes re-running the job the same day a no-op instead of a duplicate send.
- Test files live under `lagoagro/tests/`, one file per concern, matching the project's existing per-app convention — never a per-app `tests.py`.
- All commands in this plan assume the working directory is `lagoagro/` and use `uv run pytest` / `uv run python manage.py ...` / `uv add ...`.
- Conventional Commits: scope `notifications` for everything in the new app, scope `tasks` for the `Tarefa.notificado_em` field change (Task 2) — don't mix the two scopes in one commit.
- Money/date conventions already established elsewhere in the project (Decimal for money, `usuario` never exposed as a writable serializer field when it's set server-side) apply here too, though this plan has no money fields.

---

### Task 1: `notifications` app scaffold + `PushSubscription` model + settings + `pywebpush` dependency

**Files:**
- Create: `lagoagro/notifications/__init__.py`
- Create: `lagoagro/notifications/apps.py`
- Create: `lagoagro/notifications/models.py`
- Create: `lagoagro/notifications/admin.py`
- Create (generated): `lagoagro/notifications/migrations/__init__.py`, `lagoagro/notifications/migrations/0001_initial.py`
- Modify: `lagoagro/core/settings.py`
- Modify: `lagoagro/pyproject.toml` (via `uv add pywebpush`)
- Modify: `CLAUDE.md`
- Create: `lagoagro/tests/test_notifications_models.py`

**Interfaces:**
- Consumes: `settings.AUTH_USER_MODEL` (Django built-in).
- Produces: `notifications.models.PushSubscription` with fields `usuario` (FK, CASCADE, `related_name="push_subscriptions"`), `endpoint` (URLField, unique), `p256dh` (CharField), `auth` (CharField), `criado_em` (DateTimeField, `auto_now_add=True`). Settings gain `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIM_EMAIL`, `NOTIFICATION_TRIGGER_SECRET` (all env-backed, empty-string/default fallback). Task 3 imports `PushSubscription`; Task 4 imports it and reads the VAPID/`pywebpush` settings; Task 5 reads `NOTIFICATION_TRIGGER_SECRET`.

- [ ] **Step 1: Add the dependency**

Run (from `lagoagro/`):
```bash
uv add pywebpush
```
Expected: `pyproject.toml`'s `dependencies` list gains a `"pywebpush>=..."` line and `uv.lock` updates.

- [ ] **Step 2: Write the failing test**

```python
# lagoagro/tests/test_notifications_models.py
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

pytestmark = pytest.mark.django_db


def test_criar_subscription_associa_usuario_e_tem_timestamp():
    from notifications.models import PushSubscription

    usuario = get_user_model().objects.create_user(username="produtor1", password="senha123")

    subscription = PushSubscription.objects.create(
        usuario=usuario,
        endpoint="https://push.example/1",
        p256dh="chave-p256dh",
        auth="chave-auth",
    )

    assert subscription.usuario == usuario
    assert subscription.criado_em is not None
    assert usuario.push_subscriptions.count() == 1


def test_endpoint_e_unico():
    from notifications.models import PushSubscription

    usuario1 = get_user_model().objects.create_user(username="produtor1", password="senha123")
    usuario2 = get_user_model().objects.create_user(username="produtor2", password="senha123")
    PushSubscription.objects.create(usuario=usuario1, endpoint="https://push.example/1", p256dh="a", auth="b")

    with pytest.raises(IntegrityError):
        PushSubscription.objects.create(usuario=usuario2, endpoint="https://push.example/1", p256dh="c", auth="d")
```

(Imports are inside each test function deliberately — the module doesn't exist yet, so a top-of-file import would fail collection for the whole file before Step 2's "run and see it fail" step can distinguish the two tests. Once the model exists, this still works fine; leave it as-is.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_notifications_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'notifications'`

- [ ] **Step 4: Create the app package**

Create `lagoagro/notifications/__init__.py` as an empty file.

```python
# lagoagro/notifications/apps.py
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    name = 'notifications'
```

```python
# lagoagro/notifications/models.py
from django.conf import settings
from django.db import models


class PushSubscription(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.usuario} - {self.endpoint[:40]}"
```

```python
# lagoagro/notifications/admin.py
from django.contrib import admin

from .models import PushSubscription

admin.site.register(PushSubscription)
```

- [ ] **Step 5: Register the app and add settings**

In `lagoagro/core/settings.py`, add `'notifications',` to `INSTALLED_APPS` (after `'finance',`):

```python
    'finance',
    'notifications',
]
```

Then add this block right after the `REFRESH_COOKIE_SAMESITE` validation block (after the `raise ImproperlyConfigured(...)` line, before the `# Password validation` section):

```python

# Web Push (ADR 005) + job diario de notificacoes (ADR 006). Chaves VAPID
# reais e o NOTIFICATION_TRIGGER_SECRET de producao sao configurados no
# Task #9 (Deploy) - o fallback vazio so serve pra rodar localmente.
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIM_EMAIL = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:admin@example.com')
NOTIFICATION_TRIGGER_SECRET = os.environ.get('NOTIFICATION_TRIGGER_SECRET', '')
```

- [ ] **Step 6: Generate and apply the migration**

Run (from `lagoagro/`):
```bash
uv run python manage.py makemigrations notifications
uv run python manage.py migrate
```
Expected: creates `notifications/migrations/0001_initial.py` with a `CreateModel` for `PushSubscription`, applies cleanly.

- [ ] **Step 7: Run tests to verify they pass**

Run: `uv run pytest tests/test_notifications_models.py -v`
Expected: PASS (2 passed)

- [ ] **Step 8: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (126 — 124 existing + 2 new)

- [ ] **Step 9: Update project docs**

In `CLAUDE.md`, three edits:

a) In "Estrutura de pastas do backend", add a line for the new app (after `finance/`, before `domain/`):
```
├── finance/               # LancamentoFinanceiro
├── notifications/         # PushSubscription, job diario de notificacao (ADR 006)
├── domain/                # lógica pura de cálculo, SEM dependência de Django
```

b) In "Entidades principais", add a line after `LancamentoFinanceiro`:
```
LancamentoFinanceiro (plantio, valor, data, descricao)
PushSubscription (usuario, endpoint, p256dh, auth)
```

c) In "Convenção de commits", add `notifications` to the valid scopes list:
```
Escopos válidos (batem com a estrutura de pastas): `properties`, `crops`,
`plantings`, `inputs`, `tasks`, `harvest`, `finance`, `notifications`,
`domain`, `auth`, `adr`.
```

- [ ] **Step 10: Commit**

```bash
git add lagoagro/notifications lagoagro/core/settings.py lagoagro/pyproject.toml lagoagro/uv.lock lagoagro/tests/test_notifications_models.py CLAUDE.md
git commit -m "feat(notifications): adicionar app e model PushSubscription"
```

---

### Task 2: `Tarefa.notificado_em`

**Files:**
- Modify: `lagoagro/tasks/models.py`
- Modify: `lagoagro/tests/test_tarefas_colheitas_financeiro_models.py`
- Create (generated): `lagoagro/tasks/migrations/0002_tarefa_notificado_em.py`

**Interfaces:**
- Consumes: existing `tasks.models.Tarefa`.
- Produces: `Tarefa.notificado_em` (nullable `DateTimeField`). Task 4's service filters on this field and sets it after processing a tarefa.

- [ ] **Step 1: Write the failing test**

Append to `lagoagro/tests/test_tarefas_colheitas_financeiro_models.py`, directly after `test_tarefa_pertence_a_um_plantio_e_comeca_nao_concluida`:

```python
def test_tarefa_notificado_em_comeca_nulo():
    plantio = _criar_plantio()

    tarefa = Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data="2026-02-01")

    assert tarefa.notificado_em is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_tarefas_colheitas_financeiro_models.py -v`
Expected: FAIL — `AttributeError: 'Tarefa' object has no attribute 'notificado_em'`

- [ ] **Step 3: Write minimal implementation**

In `lagoagro/tasks/models.py`, add the field to `Tarefa`:

```python
from django.db import models


class Tarefa(models.Model):
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="tarefas")
    descricao = models.CharField(max_length=255)
    data = models.DateField()
    concluida = models.BooleanField(default=False)
    notificado_em = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.descricao} ({self.data})"
```

- [ ] **Step 4: Generate and apply the migration**

Run (from `lagoagro/`):
```bash
uv run python manage.py makemigrations tasks
uv run python manage.py migrate
```
Expected: creates `tasks/migrations/0002_tarefa_notificado_em.py` (`AddField`), applies cleanly.

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_tarefas_colheitas_financeiro_models.py -v`
Expected: PASS (all tests in this file, including the new one)

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (127 — 126 from Task 1 + 1 new)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/tasks/models.py lagoagro/tasks/migrations/0002_tarefa_notificado_em.py lagoagro/tests/test_tarefas_colheitas_financeiro_models.py
git commit -m "feat(tasks): adicionar campo notificado_em para idempotencia do job diario"
```

---

### Task 3: `PushSubscriptionSerializer` + `PushSubscriptionViewSet` + registration API

**Files:**
- Create: `lagoagro/notifications/serializers.py`
- Modify: `lagoagro/notifications/views.py` (create if it doesn't already exist as an empty stub — it won't, since `startapp` wasn't used; create it fresh)
- Modify: `lagoagro/core/urls.py`
- Create: `lagoagro/tests/test_notifications_views.py`

**Interfaces:**
- Consumes: `notifications.models.PushSubscription` (Task 1), `core.permissions.UsuarioScopedQuerySetMixin` (existing).
- Produces: `PushSubscriptionViewSet` registered on the router as `push-subscriptions` (i.e. `/api/push-subscriptions/`). Not consumed by any later task in this plan — this is the registration surface the Task #8 frontend will call.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_notifications_views.py
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from notifications.models import PushSubscription


def test_registrar_subscription_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "chave-p256dh", "auth": "chave-auth",
    })

    assert response.status_code == 201
    assert response.data["id"] is not None
    assert PushSubscription.objects.get(endpoint="https://push.example/1").usuario == usuario


def test_reregistrar_mesmo_endpoint_atualiza_em_vez_de_duplicar(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    client.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "chave-antiga", "auth": "auth-antiga",
    })

    response = client.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "chave-nova", "auth": "auth-nova",
    })

    assert response.status_code == 201
    assert PushSubscription.objects.filter(endpoint="https://push.example/1").count() == 1
    assert PushSubscription.objects.get(endpoint="https://push.example/1").p256dh == "chave-nova"


def test_reregistrar_endpoint_de_outra_conta_reatribui_dono(criar_usuario_autenticado):
    _, client1 = criar_usuario_autenticado("produtor1")
    usuario2, client2 = criar_usuario_autenticado("produtor2")
    client1.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "a", "auth": "b",
    })

    client2.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "c", "auth": "d",
    })

    assert PushSubscription.objects.get(endpoint="https://push.example/1").usuario == usuario2
    assert PushSubscription.objects.count() == 1


def test_listar_subscriptions_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    PushSubscription.objects.create(usuario=outro, endpoint="https://push.example/2", p256dh="c", auth="d")

    response = client.get("/api/push-subscriptions/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_deletar_subscription_propria_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    subscription = PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")

    response = client.delete(f"/api/push-subscriptions/{subscription.id}/")

    assert response.status_code == 204
    assert not PushSubscription.objects.filter(id=subscription.id).exists()


def test_acessar_subscription_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    subscription_outro = PushSubscription.objects.create(usuario=outro, endpoint="https://push.example/1", p256dh="a", auth="b")

    response = client.get(f"/api/push-subscriptions/{subscription_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/push-subscriptions/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_notifications_views.py -v`
Expected: FAIL — `404` on all requests (route `/api/push-subscriptions/` doesn't exist yet) / `ModuleNotFoundError` if collection hits the serializer import first — either way, all 7 fail.

- [ ] **Step 3: Write the serializer**

```python
# lagoagro/notifications/serializers.py
from rest_framework import serializers

from .models import PushSubscription


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ["id", "endpoint", "p256dh", "auth", "criado_em"]
        read_only_fields = ["criado_em"]
```

- [ ] **Step 4: Write the viewset**

```python
# lagoagro/notifications/views.py
from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import PushSubscription
from .serializers import PushSubscriptionSerializer


class PushSubscriptionViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = PushSubscription.objects.all()
    serializer_class = PushSubscriptionSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        # Desvio deliberado do padrao `serializer.save(usuario=...)` usado
        # nos outros apps: o endpoint e globalmente unico, entao registrar
        # de novo o mesmo endpoint (navegador reemitindo a subscription, ou
        # outra conta no mesmo aparelho) precisa atualizar a linha existente
        # em vez de violar a constraint ou duplicar. `serializer.instance` e
        # setado manualmente pra `serializer.data` (usado pela resposta 201)
        # renderizar o objeto real, com `id` e `criado_em` incluidos.
        subscription, _ = PushSubscription.objects.update_or_create(
            endpoint=serializer.validated_data["endpoint"],
            defaults={
                "usuario": self.request.user,
                "p256dh": serializer.validated_data["p256dh"],
                "auth": serializer.validated_data["auth"],
            },
        )
        serializer.instance = subscription
```

- [ ] **Step 5: Register the route**

In `lagoagro/core/urls.py`, add the import and registration:

```python
from notifications.views import PushSubscriptionViewSet
```

```python
router.register("diarias", DiariaViewSet)
router.register("push-subscriptions", PushSubscriptionViewSet)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_notifications_views.py -v`
Expected: PASS (7 passed)

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (134 — 127 from Task 2 + 7 new)

- [ ] **Step 8: Commit**

```bash
git add lagoagro/notifications/serializers.py lagoagro/notifications/views.py lagoagro/core/urls.py lagoagro/tests/test_notifications_views.py
git commit -m "feat(notifications): adicionar API de registro de PushSubscription"
```

---

### Task 4: `enviar_notificacoes_do_dia` service

**Files:**
- Create: `lagoagro/notifications/services.py`
- Create: `lagoagro/tests/test_notifications_services.py`

**Interfaces:**
- Consumes: `notifications.models.PushSubscription` (Task 1), `tasks.models.Tarefa` + `Tarefa.notificado_em` (Task 2), `pywebpush.webpush` / `pywebpush.WebPushException`, `settings.VAPID_PRIVATE_KEY` / `settings.VAPID_CLAIM_EMAIL`.
- Produces: `notifications.services.enviar_notificacoes_do_dia(hoje=None) -> dict` returning `{"tarefas_notificadas": int, "subscriptions_removidas": int}`. Task 5 and Task 6 both import and call this function with no arguments.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_notifications_services.py
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from pywebpush import WebPushException

from crops.models import Cultura
from notifications.models import PushSubscription
from notifications.services import enviar_notificacoes_do_dia
from plantings.models import Plantio
from properties.models import Propriedade, Talhao
from tasks.models import Tarefa

pytestmark = pytest.mark.django_db


class _FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


def _criar_plantio_e_usuario(username="produtor1"):
    usuario = get_user_model().objects.create_user(username=username, password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura, _ = Cultura.objects.get_or_create(nome="Pimentao", defaults={"ciclo_dias": 90})
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    return usuario, plantio


def test_envia_push_para_tarefa_de_hoje_nao_concluida():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 1
    assert resultado == {"tarefas_notificadas": 1, "subscriptions_removidas": 0}


def test_pula_tarefa_concluida():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje, concluida=True)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 0
    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 0}


def test_pula_tarefa_de_outro_dia():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje + timedelta(days=1))

    with patch("notifications.services.webpush") as mock_webpush:
        enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 0


def test_envia_para_todas_as_subscriptions_do_usuario():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/2", p256dh="c", auth="d")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 2
    assert resultado["tarefas_notificadas"] == 2


def test_subscription_expirada_e_removida_em_410():
    usuario, plantio = _criar_plantio_e_usuario()
    subscription = PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush", side_effect=WebPushException("gone", response=_FakeResponse(410))):
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 1}
    assert not PushSubscription.objects.filter(id=subscription.id).exists()


def test_erro_temporario_mantem_subscription():
    usuario, plantio = _criar_plantio_e_usuario()
    subscription = PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush", side_effect=WebPushException("erro temporario", response=_FakeResponse(500))):
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 0}
    assert PushSubscription.objects.filter(id=subscription.id).exists()


def test_rodar_duas_vezes_no_mesmo_dia_nao_duplica_envio():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        enviar_notificacoes_do_dia(hoje=hoje)
        enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_notifications_services.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'notifications.services'`

- [ ] **Step 3: Write minimal implementation**

```python
# lagoagro/notifications/services.py
import json

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from pywebpush import WebPushException, webpush

from tasks.models import Tarefa


def enviar_notificacoes_do_dia(hoje=None):
    hoje = hoje or timezone.localdate()
    tarefas = (
        Tarefa.objects.filter(concluida=False, data=hoje)
        .filter(Q(notificado_em__isnull=True) | Q(notificado_em__date__lt=hoje))
        .select_related("plantio__talhao__propriedade__usuario")
    )

    enviadas = 0
    removidas = 0
    for tarefa in tarefas:
        usuario = tarefa.plantio.talhao.propriedade.usuario
        for subscription in usuario.push_subscriptions.all():
            enviado, expirada = _enviar_push(subscription, tarefa)
            if enviado:
                enviadas += 1
            if expirada:
                subscription.delete()
                removidas += 1
        tarefa.notificado_em = timezone.now()
        tarefa.save(update_fields=["notificado_em"])

    return {"tarefas_notificadas": enviadas, "subscriptions_removidas": removidas}


def _enviar_push(subscription, tarefa):
    payload = json.dumps({"title": "LagoAgro", "body": f"Tarefa de hoje: {tarefa.descricao}"})
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL},
        )
        return True, False
    except WebPushException as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        expirada = status_code in (404, 410)
        return False, expirada
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_notifications_services.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (141 — 134 from Task 3 + 7 new)

- [ ] **Step 6: Commit**

```bash
git add lagoagro/notifications/services.py lagoagro/tests/test_notifications_services.py
git commit -m "feat(notifications): adicionar servico enviar_notificacoes_do_dia idempotente"
```

---

### Task 5: Trigger endpoint protegido por chave secreta

**Files:**
- Modify: `lagoagro/notifications/views.py`
- Modify: `lagoagro/core/urls.py`
- Create: `lagoagro/tests/test_notifications_trigger_view.py`

**Interfaces:**
- Consumes: `notifications.services.enviar_notificacoes_do_dia` (Task 4), `settings.NOTIFICATION_TRIGGER_SECRET` (Task 1).
- Produces: `POST /api/notificacoes/disparar/`, header `X-Notification-Secret`, response body `{"tarefas_notificadas": int, "subscriptions_removidas": int}` on success, `{"detail": "..."}` + 403 on auth failure.

- [ ] **Step 1: Write the failing tests**

```python
# lagoagro/tests/test_notifications_trigger_view.py
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APIClient


@override_settings(NOTIFICATION_TRIGGER_SECRET="segredo-teste")
def test_secret_valido_dispara_e_retorna_200():
    client = APIClient()

    with patch("notifications.views.enviar_notificacoes_do_dia") as mock_enviar:
        mock_enviar.return_value = {"tarefas_notificadas": 2, "subscriptions_removidas": 0}
        response = client.post("/api/notificacoes/disparar/", HTTP_X_NOTIFICATION_SECRET="segredo-teste")

    assert response.status_code == 200
    assert response.data == {"tarefas_notificadas": 2, "subscriptions_removidas": 0}
    mock_enviar.assert_called_once()


@override_settings(NOTIFICATION_TRIGGER_SECRET="segredo-teste")
def test_sem_header_retorna_403():
    client = APIClient()

    response = client.post("/api/notificacoes/disparar/")

    assert response.status_code == 403


@override_settings(NOTIFICATION_TRIGGER_SECRET="segredo-teste")
def test_secret_errado_retorna_403():
    client = APIClient()

    response = client.post("/api/notificacoes/disparar/", HTTP_X_NOTIFICATION_SECRET="errado")

    assert response.status_code == 403


@override_settings(NOTIFICATION_TRIGGER_SECRET="")
def test_secret_nao_configurado_falha_fechado():
    client = APIClient()

    response = client.post("/api/notificacoes/disparar/", HTTP_X_NOTIFICATION_SECRET="qualquer-coisa")

    assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_notifications_trigger_view.py -v`
Expected: FAIL — 404 on all four (route doesn't exist yet)

- [ ] **Step 3: Write the view**

Append to `lagoagro/notifications/views.py`:

```python
import secrets

from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import enviar_notificacoes_do_dia


class DispararNotificacoesView(APIView):
    """Endpoint chamado pelo cron externo (ADR 006) - sem JWT, protegido por
    chave secreta no header (threat-model.md: comparacao com
    secrets.compare_digest, nunca em query string, falha fechado se a chave
    nao estiver configurada)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        secret_recebido = request.headers.get("X-Notification-Secret", "")
        secret_esperado = settings.NOTIFICATION_TRIGGER_SECRET
        if not secret_esperado or not secrets.compare_digest(secret_recebido, secret_esperado):
            return Response({"detail": "Não autorizado."}, status=403)

        resultado = enviar_notificacoes_do_dia()
        return Response(resultado)
```

- [ ] **Step 4: Register the route**

In `lagoagro/core/urls.py`, add the import:

```python
from notifications.views import DispararNotificacoesView, PushSubscriptionViewSet
```

(replacing the Task 3 single-name import line), and add the path inside `urlpatterns`, after the `api/` router include:

```python
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/notificacoes/disparar/', DispararNotificacoesView.as_view(), name='notificacoes-disparar'),
    path('api/', include(router.urls)),
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_notifications_trigger_view.py -v`
Expected: PASS (4 passed)

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (145 — 141 from Task 4 + 4 new)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/notifications/views.py lagoagro/core/urls.py lagoagro/tests/test_notifications_trigger_view.py
git commit -m "feat(notifications): adicionar endpoint de disparo protegido por chave secreta"
```

---

### Task 6: Management command `enviar_notificacoes_do_dia`

**Files:**
- Create: `lagoagro/notifications/management/__init__.py`
- Create: `lagoagro/notifications/management/commands/__init__.py`
- Create: `lagoagro/notifications/management/commands/enviar_notificacoes_do_dia.py`
- Create: `lagoagro/tests/test_notifications_management_command.py`

**Interfaces:**
- Consumes: `notifications.services.enviar_notificacoes_do_dia` (Task 4).
- Produces: `python manage.py enviar_notificacoes_do_dia`, the ADR 006 command. Nothing later in this plan depends on it.

- [ ] **Step 1: Write the failing test**

```python
# lagoagro/tests/test_notifications_management_command.py
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command


def test_comando_chama_servico_e_imprime_resumo():
    saida = StringIO()

    with patch(
        "notifications.management.commands.enviar_notificacoes_do_dia.enviar_notificacoes_do_dia"
    ) as mock_enviar:
        mock_enviar.return_value = {"tarefas_notificadas": 3, "subscriptions_removidas": 1}
        call_command("enviar_notificacoes_do_dia", stdout=saida)

    mock_enviar.assert_called_once()
    assert "3" in saida.getvalue()
    assert "1" in saida.getvalue()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_notifications_management_command.py -v`
Expected: FAIL — `django.core.management.base.CommandError: Unknown command: 'enviar_notificacoes_do_dia'`

- [ ] **Step 3: Write minimal implementation**

Create `lagoagro/notifications/management/__init__.py` and
`lagoagro/notifications/management/commands/__init__.py` as empty files.

```python
# lagoagro/notifications/management/commands/enviar_notificacoes_do_dia.py
from django.core.management.base import BaseCommand

from notifications.services import enviar_notificacoes_do_dia


class Command(BaseCommand):
    help = "Envia push notification para tarefas que vencem hoje (ADR 006)."

    def handle(self, *args, **options):
        resultado = enviar_notificacoes_do_dia()
        self.stdout.write(self.style.SUCCESS(
            f"{resultado['tarefas_notificadas']} notificacoes enviadas, "
            f"{resultado['subscriptions_removidas']} subscriptions expiradas removidas."
        ))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_notifications_management_command.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (146 — 145 from Task 5 + 1 new)

- [ ] **Step 6: Commit**

```bash
git add lagoagro/notifications/management lagoagro/tests/test_notifications_management_command.py
git commit -m "feat(notifications): adicionar management command enviar_notificacoes_do_dia"
```

---

## Post-plan note

This plan delivers the full backend capability for RF11 — registration API, idempotent sending service, secret-protected trigger endpoint, and management command — all covered by tests with `pywebpush` mocked. **Nothing in this plan is wired to a real cron or real VAPID keys.** Task #9 (Deploy) still needs to: generate real VAPID keys (`vapid --gen` or equivalent) and set `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_CLAIM_EMAIL`/`NOTIFICATION_TRIGGER_SECRET` in the production environment; write a `.github/workflows/` scheduled workflow (or configure the host's native cron) that does a daily `POST` to `/api/notificacoes/disparar/` with the `X-Notification-Secret` header; and decide whether `django-cors-headers` is needed for the frontend origin (already flagged in `project_lagoagro_drf_viewsets_por_app` memory, applies here too since Task #8's frontend will call `/api/push-subscriptions/`).
