# Auth JWT + Isolamento Multi-tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement JWT authentication (login/refresh/logout, refresh token in an HttpOnly cookie) via `djangorestframework-simplejwt`, and a reusable `UsuarioScopedQuerySetMixin` that Task #6's future viewsets will inherit for multi-tenant data isolation.

**Architecture:** Everything lives in the existing `core` app (`core/auth_views.py`, `core/permissions.py`) — authentication and tenant-isolation are cross-cutting infrastructure, not domain entities, so no new app is created. Tasks execute in dependency order: settings/login first (nothing else works without it), then refresh (depends on login's cookie), then logout (depends on refresh's rotation/blacklist setup), then the queryset mixin (independent of 1-3, ordered last only because it's a separate concern from the auth flow). Full spec: `docs/superpowers/specs/2026-07-31-auth-jwt-multitenant-design.md`.

**Tech Stack:** Django 6.0, Django REST Framework 3.17 (both already installed), `djangorestframework-simplejwt` (new dependency), pytest + pytest-django, SQLite dev database.

## Global Constraints

- No public registration endpoint in this plan (user's explicit decision) — accounts are created via Django admin/`createsuperuser`.
- Rate limiting on login is explicitly OUT of scope for this plan (deferred to the deploy task) — do not add `django-ratelimit` or similar here.
- JWT lifetimes are fixed by ADR 003: access token 15 minutes, refresh token 7 days.
- The refresh token NEVER appears in a JSON response body — only as an `HttpOnly` cookie named `refresh`. Any test or code that finds `"refresh"` in a response's `.data` (not `.cookies`) is a bug.
- `DEFAULT_PERMISSION_CLASSES` defaults every DRF view to `IsAuthenticated` — only `LoginView` and `RefreshView` are explicitly `AllowAny` (a refresh call happens precisely because the caller has no valid access token yet, so it cannot be `IsAuthenticated`).
- Cookie attributes (`Secure`, `SameSite`) come from environment variables with dev-safe defaults, following the exact pattern already used for `SECRET_KEY`/`DEBUG` in `core/settings.py` (`os.environ.get(...)`).
- Test files live under `lagoagro/tests/`, not per-app `tests.py`.
- All commands in this plan assume the working directory is `lagoagro/` and use `uv run pytest` / `uv run python manage.py ...`.
- Conventional Commits: scope `auth` for all commits in this plan.

---

### Task 1: Settings + Login

**Files:**
- Modify: `lagoagro/pyproject.toml`
- Modify: `lagoagro/core/settings.py`
- Create: `lagoagro/core/auth_views.py`
- Modify: `lagoagro/core/urls.py`
- Create: `lagoagro/tests/test_auth.py`

**Interfaces:**
- Consumes: `django.contrib.auth.get_user_model()` (Django built-in), `djangorestframework-simplejwt`'s `TokenObtainPairView`/`TokenObtainPairSerializer`.
- Produces: `POST /api/auth/login/` — `core.auth_views.LoginView`. Response body: `{"access": "<jwt>", "user": {"id": <int>, "username": "<str>"}}`. Sets an `HttpOnly` cookie named `refresh`. Settings additions (`REST_FRAMEWORK`, `SIMPLE_JWT`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_SAMESITE`) are consumed by Tasks 2 and 3.

- [ ] **Step 1: Add the dependency**

In `lagoagro/pyproject.toml`, add to `dependencies`:
```toml
dependencies = [
    "django>=5.1",
    "djangorestframework>=3.15",
    "djangorestframework-simplejwt>=5.3",
]
```

Run (from `lagoagro/`):
```bash
uv sync
```

- [ ] **Step 2: Write the failing tests**

```python
# lagoagro/tests/test_auth.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def _criar_usuario():
    return get_user_model().objects.create_user(username="produtor1", password="senha123")


def test_login_com_credenciais_corretas_retorna_access_e_cookie_refresh():
    usuario = _criar_usuario()
    client = APIClient()

    response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})

    assert response.status_code == 200
    assert "access" in response.data
    assert response.data["user"] == {"id": usuario.id, "username": "produtor1"}
    assert "refresh" not in response.data
    assert "refresh" in response.cookies
    assert response.cookies["refresh"]["httponly"] is True


def test_login_com_senha_errada_retorna_401():
    _criar_usuario()
    client = APIClient()

    response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha_errada"})

    assert response.status_code == 401
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_auth.py -v`
Expected: FAIL — `django.urls.exceptions.NoReverseMatch` or a 404 (the URL `/api/auth/login/` doesn't exist yet), or `ModuleNotFoundError` if `rest_framework_simplejwt` isn't installed yet (it should already be, from Step 1).

- [ ] **Step 4: Configure settings**

In `lagoagro/core/settings.py`:

1. Add to the top-level imports:
```python
from datetime import timedelta
```

2. Add to `INSTALLED_APPS`, after `'rest_framework'`:
```python
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'core',
```

3. Add after the `DATABASES` block (or any top-level location — exact position doesn't matter, group it as one block):
```python
# JWT (ADR 003): access curto, refresh mais longo em cookie HttpOnly.
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# Atributos do cookie de refresh - Secure exige HTTPS, entao soh eh True em
# producao (variavel de ambiente, mesmo padrao de SECRET_KEY/DEBUG acima).
REFRESH_COOKIE_SECURE = os.environ.get('REFRESH_COOKIE_SECURE', 'False') == 'True'
REFRESH_COOKIE_SAMESITE = os.environ.get('REFRESH_COOKIE_SAMESITE', 'Lax')
```

- [ ] **Step 5: Implement LoginView**

```python
# lagoagro/core/auth_views.py
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        refresh = data["refresh"]
        access = data["access"]
        usuario = serializer.user

        response = Response({
            "access": access,
            "user": {"id": usuario.id, "username": usuario.username},
        })
        response.set_cookie(
            "refresh",
            str(refresh),
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
        )
        return response
```

- [ ] **Step 6: Wire the URL**

```python
# lagoagro/core/urls.py
from django.contrib import admin
from django.urls import path

from core.auth_views import LoginView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
]
```

- [ ] **Step 7: Run migrations**

Run (from `lagoagro/`):
```bash
uv run python manage.py migrate
```
Expected: applies `token_blacklist`'s own bundled migrations (`0001_initial` etc. under `rest_framework_simplejwt.token_blacklist`) — no `makemigrations` needed, this app ships its migrations pre-built.

- [ ] **Step 8: Run tests to verify they pass**

Run: `uv run pytest tests/test_auth.py -v`
Expected: PASS (2 passed)

- [ ] **Step 9: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (56 — 54 existing + 2 new)

- [ ] **Step 10: Commit**

```bash
git add lagoagro/pyproject.toml lagoagro/uv.lock lagoagro/core/settings.py lagoagro/core/auth_views.py lagoagro/core/urls.py lagoagro/tests/test_auth.py
git commit -m "feat(auth): adicionar login JWT com refresh em cookie HttpOnly"
```
(Include `lagoagro/uv.lock` only if `uv sync` in Step 1 modified it — check `git status` first.)

---

### Task 2: Refresh

**Files:**
- Modify: `lagoagro/core/auth_views.py`
- Modify: `lagoagro/core/urls.py`
- Modify: `lagoagro/tests/test_auth.py`

**Interfaces:**
- Consumes: `core.auth_views.LoginView` (Task 1, for the login-then-refresh test flow).
- Produces: `POST /api/auth/refresh/` — `core.auth_views.RefreshView`. Reads the `refresh` cookie from the request (not the body). Response body: `{"access": "<jwt>"}`. Re-sets a rotated `refresh` cookie. Task 3 (logout) relies on the same rotation/blacklist mechanism being active.

- [ ] **Step 1: Write the failing tests**

Append to `lagoagro/tests/test_auth.py`:

```python
def test_refresh_com_cookie_valido_retorna_novo_access_e_rotaciona_cookie():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    cookie_antigo = login_response.cookies["refresh"].value

    refresh_response = client.post("/api/auth/refresh/")

    assert refresh_response.status_code == 200
    assert "access" in refresh_response.data
    assert "refresh" not in refresh_response.data
    assert refresh_response.cookies["refresh"].value != cookie_antigo


def test_refresh_sem_cookie_retorna_401():
    client = APIClient()

    response = client.post("/api/auth/refresh/")

    assert response.status_code == 401


def test_reusar_refresh_token_ja_rotacionado_retorna_401():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    token_antigo = login_response.cookies["refresh"].value

    client.post("/api/auth/refresh/")  # rotaciona - client.cookies fica com o token novo

    client.cookies["refresh"] = token_antigo  # forca reenvio do token antigo (ja rotacionado)
    response = client.post("/api/auth/refresh/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_auth.py -v`
Expected: FAIL — the 3 new tests fail with 404 (no `/api/auth/refresh/` URL yet).

- [ ] **Step 3: Implement RefreshView**

Append to `lagoagro/core/auth_views.py`:

```python
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenRefreshView


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get("refresh")
        if refresh_token is None:
            raise AuthenticationFailed("Refresh token nao encontrado.")

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        data = serializer.validated_data
        novo_refresh = data["refresh"]
        access = data["access"]

        response = Response({"access": access})
        response.set_cookie(
            "refresh",
            str(novo_refresh),
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
        )
        return response
```

Add `AuthenticationFailed` (from `rest_framework.exceptions`), `InvalidToken` and `TokenError` (from `rest_framework_simplejwt.exceptions`), and `TokenRefreshView` (from `rest_framework_simplejwt.views`) to the existing import block at the top of `core/auth_views.py`, alongside the imports `LoginView` already uses there.

- [ ] **Step 4: Wire the URL**

In `lagoagro/core/urls.py`:

```python
from core.auth_views import LoginView, RefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/refresh/', RefreshView.as_view(), name='auth-refresh'),
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_auth.py -v`
Expected: PASS (5 passed — 2 from Task 1 + 3 new)

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (59 — 54 existing + 5)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/core/auth_views.py lagoagro/core/urls.py lagoagro/tests/test_auth.py
git commit -m "feat(auth): adicionar refresh de token via cookie com rotacao"
```

---

### Task 3: Logout

**Files:**
- Modify: `lagoagro/core/auth_views.py`
- Modify: `lagoagro/core/urls.py`
- Modify: `lagoagro/tests/test_auth.py`

**Interfaces:**
- Consumes: `core.auth_views.LoginView`, `core.auth_views.RefreshView` (Tasks 1-2, for the login-then-logout-then-refresh test flow).
- Produces: `POST /api/auth/logout/` — `core.auth_views.LogoutView`. Requires an authenticated request (`Authorization: Bearer <access>` header) since it's not `AllowAny`. Blacklists the `refresh` cookie's token and deletes the cookie. Idempotent: returns `200` even without a `refresh` cookie.

- [ ] **Step 1: Write the failing tests**

Append to `lagoagro/tests/test_auth.py`:

```python
def test_logout_invalida_refresh_token_impedindo_reuso():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    access = login_response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    logout_response = client.post("/api/auth/logout/")

    assert logout_response.status_code == 200

    refresh_response = client.post("/api/auth/refresh/")
    assert refresh_response.status_code == 401


def test_logout_sem_cookie_refresh_ainda_retorna_200():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    access = login_response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    client.cookies.pop("refresh", None)

    response = client.post("/api/auth/logout/")

    assert response.status_code == 200


def test_rota_protegida_sem_token_retorna_401():
    client = APIClient()

    response = client.post("/api/auth/logout/")

    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_auth.py -v`
Expected: FAIL — 3 new tests fail with 404 (no `/api/auth/logout/` URL yet).

- [ ] **Step 3: Implement LogoutView**

Append to `lagoagro/core/auth_views.py`:

```python
from rest_framework import status
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


class LogoutView(APIView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get("refresh")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass  # token ja invalido/expirado - nada a fazer, logout eh idempotente

        response = Response(status=status.HTTP_200_OK)
        response.delete_cookie("refresh")
        return response
```

(`LogoutView` has no `permission_classes` override, so it uses the project default `IsAuthenticated` from `REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES']` set in Task 1 — this is what makes `test_rota_protegida_sem_token_retorna_401` pass.)

- [ ] **Step 4: Wire the URL**

In `lagoagro/core/urls.py`:

```python
from core.auth_views import LoginView, LogoutView, RefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_auth.py -v`
Expected: PASS (8 passed — 5 from Tasks 1-2 + 3 new)

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (62 — 54 existing + 8)

- [ ] **Step 7: Commit**

```bash
git add lagoagro/core/auth_views.py lagoagro/core/urls.py lagoagro/tests/test_auth.py
git commit -m "feat(auth): adicionar logout com blacklist do refresh token"
```

---

### Task 4: Multi-tenant queryset mixin

**Files:**
- Create: `lagoagro/core/permissions.py`
- Create: `lagoagro/tests/test_usuario_scoped_queryset.py`

**Interfaces:**
- Consumes: `properties.models.Propriedade`, `properties.models.Talhao` (existing), `rest_framework.viewsets.ReadOnlyModelViewSet` (DRF built-in).
- Produces: `core.permissions.UsuarioScopedQuerySetMixin` with class attribute `usuario_lookup` (default `"usuario"`) and a `get_queryset()` override. Task #6 (not part of this plan) will import this mixin for every app's real viewsets.

This task is independent of Tasks 1-3 (no shared code), grouped last only because the spec presents auth flow and tenant isolation as separate concerns.

- [ ] **Step 1: Write the failing tests**

This test file needs `core.permissions.UsuarioScopedQuerySetMixin`, which doesn't exist until Step 3 — that's expected and is exactly what makes these tests fail correctly in Step 2. Write the complete file now:

```python
# lagoagro/tests/test_usuario_scoped_queryset.py
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.test import APIRequestFactory, force_authenticate

from core.permissions import UsuarioScopedQuerySetMixin
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


class _TalhaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Talhao
        fields = ["id", "nome"]


@pytest.fixture
def talhao_test_viewset():
    class _TalhaoTestViewSet(UsuarioScopedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
        queryset = Talhao.objects.all()
        serializer_class = _TalhaoSerializer
        permission_classes = [IsAuthenticated]
        usuario_lookup = "propriedade__usuario"

    return _TalhaoTestViewSet


def _criar_usuarios_e_talhoes():
    User = get_user_model()
    usuario_a = User.objects.create_user(username="produtor_a", password="senha123")
    usuario_b = User.objects.create_user(username="produtor_b", password="senha123")
    propriedade_a = Propriedade.objects.create(usuario=usuario_a, nome="Sitio A")
    propriedade_b = Propriedade.objects.create(usuario=usuario_b, nome="Sitio B")
    talhao_a1 = Talhao.objects.create(propriedade=propriedade_a, nome="Talhao A1", area=Decimal("1.00"), tipo_solo="argiloso")
    Talhao.objects.create(propriedade=propriedade_a, nome="Talhao A2", area=Decimal("2.00"), tipo_solo="arenoso")
    talhao_b1 = Talhao.objects.create(propriedade=propriedade_b, nome="Talhao B1", area=Decimal("3.00"), tipo_solo="argiloso")
    return usuario_a, usuario_b, talhao_a1, talhao_b1


def test_listagem_so_retorna_talhoes_do_usuario_autenticado(talhao_test_viewset):
    usuario_a, _, _, _ = _criar_usuarios_e_talhoes()

    factory = APIRequestFactory()
    request = factory.get("/fake-url/")
    force_authenticate(request, user=usuario_a)
    view = talhao_test_viewset.as_view({"get": "list"})
    response = view(request)

    assert response.status_code == 200
    assert {t["nome"] for t in response.data} == {"Talhao A1", "Talhao A2"}


def test_usuario_pedindo_talhao_de_outro_usuario_recebe_404(talhao_test_viewset):
    _, usuario_b, talhao_a1, _ = _criar_usuarios_e_talhoes()

    factory = APIRequestFactory()
    request = factory.get(f"/fake-url/{talhao_a1.id}/")
    force_authenticate(request, user=usuario_b)
    view = talhao_test_viewset.as_view({"get": "retrieve"})
    response = view(request, pk=talhao_a1.id)

    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_usuario_scoped_queryset.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'core.permissions'`

- [ ] **Step 3: Write minimal implementation**

```python
# lagoagro/core/permissions.py
class UsuarioScopedQuerySetMixin:
    usuario_lookup = "usuario"

    def get_queryset(self):
        return super().get_queryset().filter(**{self.usuario_lookup: self.request.user})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_usuario_scoped_queryset.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `uv run pytest -q`
Expected: all tests pass (64 — 54 existing + 8 auth + 2 new)

- [ ] **Step 6: Commit**

```bash
git add lagoagro/core/permissions.py lagoagro/tests/test_usuario_scoped_queryset.py
git commit -m "feat(auth): adicionar UsuarioScopedQuerySetMixin para isolamento multi-tenant"
```

---

## Post-plan note

This plan delivers the auth flow and the isolation mixin, but no real domain viewsets use either yet — that's Task #6 (Serializers/views/permissions DRF por app), which will: (a) build a serializer + `ModelViewSet` per app inheriting `UsuarioScopedQuerySetMixin` with the correct `usuario_lookup` for that model's ownership chain, (b) wire `Authorization: Bearer` handling into whatever HTTP client the frontend (Task #8) uses, including a refresh-on-401 interceptor, and (c) apply the cross-tenant consistency rule already flagged in `docs/superpowers/plans/2026-07-31-trabalhadores-diarias.md`'s post-plan note for `Diaria` specifically (validate both FK chains agree, not just that each is individually scoped to `request.user`).
