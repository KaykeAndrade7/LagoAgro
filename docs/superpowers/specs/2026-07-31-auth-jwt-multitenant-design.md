# Auth JWT + Isolamento Multi-tenant (queryset base) — Design

## Contexto e motivação

Até aqui o projeto só tem models — nenhuma rota de API além do admin do
Django. Esta é a Task #5 do roadmap geral: implementar autenticação (RF13)
e a camada reutilizável de isolamento multi-tenant que toda view futura
(Task #6) vai herdar. As decisões de "como autenticar" já estão fechadas nas
ADR 002 e ADR 003 — esta spec é sobre a implementação concreta, não sobre
reabrir essas escolhas.

## Decisões já validadas com o usuário

- **Sem endpoint público de registro.** Contas são criadas via Django admin
  ou management command, como já é o padrão deste projeto (`anonimizar_usuario`
  segue o mesmo modelo de operação manual). Um endpoint de registro pode virar
  uma task separada se/quando o multiusuário for prioridade real.
- Rate limiting no login fica fora desta task — é item do checklist de
  *produção* no `threat-model.md` (seção 3), não um requisito funcional
  (RF13), e entra na Task #9 (deploy).

## Arquitetura

Tudo vive em `core/` (o app de configuração já existente) — autenticação é
infraestrutura transversal, não uma entidade de domínio, então não justifica
um app novo.

```
core/
├── settings.py       # SIMPLE_JWT, REST_FRAMEWORK, cookie config (modificado)
├── urls.py           # /api/auth/login|refresh|logout (modificado)
├── auth_views.py      # LoginView, RefreshView, LogoutView (novo)
└── permissions.py     # UsuarioScopedQuerySetMixin (novo)
```

## Componentes

### Configuração (`core/settings.py`)

- `INSTALLED_APPS` ganha `rest_framework_simplejwt` e
  `rest_framework_simplejwt.token_blacklist` (a segunda é o que faz
  `logout` invalidar de verdade um refresh token, não só apagar o cookie do
  lado do cliente — sem ela, um refresh token roubado antes do logout
  continua válido até expirar sozinho).
- `REST_FRAMEWORK = {"DEFAULT_AUTHENTICATION_CLASSES": [...JWTAuthentication], "DEFAULT_PERMISSION_CLASSES": [...IsAuthenticated]}`
  — toda view nova nasce protegida por padrão; precisa marcar
  `permission_classes = [AllowAny]` explicitamente para abrir uma rota
  pública (login é a única exceção nesta task).
- `SIMPLE_JWT = {"ACCESS_TOKEN_LIFETIME": timedelta(minutes=15), "REFRESH_TOKEN_LIFETIME": timedelta(days=7), "ROTATE_REFRESH_TOKENS": True, "BLACKLIST_AFTER_ROTATION": True}`
  — valores já fixados pela ADR 003. `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`
  significa que cada `/refresh/` invalida o refresh token anterior e emite
  um novo — se um refresh token vazar, ele só é utilizável uma vez antes de
  o dono legítimo "correr na frente" no próximo refresh natural do app.
- Atributos do cookie de refresh via variável de ambiente, mesmo padrão já
  usado para `SECRET_KEY`/`DEBUG`:
  - `REFRESH_COOKIE_SECURE` (default `False` em dev, deve ser `True` em
    produção — cookie `Secure` exige HTTPS)
  - `REFRESH_COOKIE_SAMESITE` (default `"Lax"` em dev; produção cross-origin
    real — frontend em domínio diferente do backend — precisa de `"None"`,
    que por sua vez *exige* `Secure=True` para o navegador aceitar)

### Views (`core/auth_views.py`)

- **`LoginView`** (subclasse de `TokenObtainPairView` do simplejwt):
  - Reaproveita a validação de usuário/senha do simplejwt.
  - Na resposta: corpo JSON com `{"access": "<token>", "user": {"id": ..., "username": ...}}` — **nunca** o refresh token no corpo.
  - Seta o refresh token como cookie `HttpOnly` (`httponly=True`), com os
    atributos `Secure`/`SameSite` vindos das settings acima.
  - `permission_classes = [AllowAny]` (é a única rota pública desta task).
- **`RefreshView`** (subclasse de `TokenRefreshView`):
  - Lê o refresh token do cookie da requisição, não do corpo (sobrescreve o
    método que o simplejwt usa para extrair o refresh token da request).
  - Se o cookie não existir ou o token for inválido/expirado/blacklisted:
    `401`.
  - Resposta: novo `access` no corpo, novo refresh token rotacionado no
    cookie (mesmos atributos do login).
- **`LogoutView`**:
  - Lê o refresh token do cookie, adiciona à blacklist
    (`RefreshToken(token).blacklist()`).
  - Apaga o cookie (`delete_cookie`).
  - Se não houver cookie: `200` mesmo assim (logout é idempotente — não é
    erro tentar sair de uma sessão que já não existe).

### Isolamento multi-tenant (`core/permissions.py`)

`UsuarioScopedQuerySetMixin` — mixin para `ModelViewSet`/`GenericAPIView`
que qualquer view da Task #6 vai herdar:

```python
class UsuarioScopedQuerySetMixin:
    usuario_lookup = "usuario"  # sobrescrito por subclasse quando o campo
                                 # do dono não é direto (ex.: "propriedade__usuario",
                                 # "talhao__propriedade__usuario")

    def get_queryset(self):
        return super().get_queryset().filter(**{self.usuario_lookup: self.request.user})
```

Isso resolve sozinho a mitigação de IDOR do `threat-model.md`: como
`get_object()` do DRF busca dentro de `get_queryset()`, pedir o ID de um
objeto de outro usuário nunca encontra o objeto — resposta `404`, não `403`
(o mesmo comportamento para "não existe" e "existe mas não é seu", que é
exatamente o que o threat model pede para não revelar a existência do
recurso de outro usuário).

Esta task não cria os viewsets de verdade (isso é Task #6) — só o mixin e a
prova de que ele funciona.

## Fluxo de dados

```
POST /api/auth/login/ {username, password}
    → 200 {access, user} + Set-Cookie: refresh=... HttpOnly

Requisição autenticada:
    Authorization: Bearer <access>
    → JWTAuthentication valida o access token
    → view usa UsuarioScopedQuerySetMixin.get_queryset() → só dados do usuario

Access expira (15 min):
    POST /api/auth/refresh/ (cookie refresh enviado automaticamente pelo browser)
    → 200 {access} + Set-Cookie: refresh=<novo> HttpOnly (rotacionado)

POST /api/auth/logout/ (cookie refresh enviado automaticamente)
    → refresh token adicionado à blacklist, cookie apagado
    → tentativa de reusar o refresh antigo em /refresh/ → 401
```

## Tratamento de erros / casos de borda

- Login com credenciais erradas: `401` (comportamento padrão do
  `TokenObtainPairView`, sem necessidade de código extra).
- `/refresh/` sem cookie de refresh, ou cookie com token inválido/expirado/
  já usado (blacklisted): `401`.
- `/logout/` sem cookie de refresh: `200` (idempotente, não é erro).
- Requisição a uma rota protegida sem `Authorization` header, ou com access
  token expirado: `401` (comportamento padrão do `JWTAuthentication`).
- `UsuarioScopedQuerySetMixin` com `usuario_lookup` apontando para um campo
  que não existe no model: erro de configuração do desenvolvedor (Task #6),
  não um caso a tratar em runtime — surge como `FieldError` do Django na
  primeira chamada, o que já é sinal suficiente para quem está implementando
  o viewset.

## Testes previstos

Novo arquivo `lagoagro/tests/test_auth.py` (usando `rest_framework.test.APIClient`):

- Login com credenciais corretas retorna `200`, corpo com `access` e
  `user`, e um cookie `refresh` marcado `HttpOnly` (o corpo da resposta
  **não** contém a palavra `refresh`).
- Login com senha errada retorna `401`.
- `/refresh/` com o cookie do login anterior retorna `200` com novo
  `access`, e o cookie de refresh é rotacionado (valor diferente do
  anterior).
- Reusar o refresh token antigo (já rotacionado) em `/refresh/` retorna
  `401` (prova que `ROTATE_REFRESH_TOKENS`+blacklist está funcionando).
- `/logout/` seguido de uma tentativa de `/refresh/` com o mesmo cookie
  retorna `401` (prova que o logout de fato invalidou o token, não só
  removeu o cookie do lado do cliente).
- Requisição a uma rota que exige autenticação, sem header
  `Authorization`, retorna `401` (prova que `DEFAULT_PERMISSION_CLASSES`
  está configurado).

Novo arquivo `lagoagro/tests/test_usuario_scoped_queryset.py`:

- Um viewset mínimo de teste (definido dentro do próprio arquivo de teste,
  usando o model `Talhao` já existente, com
  `usuario_lookup = "propriedade__usuario"`), exercitado diretamente com
  `rest_framework.test.APIRequestFactory` + `ViewSetClasse.as_view({"get": "list"})`/
  `{"get": "retrieve"})` chamado com o request montado à mão — sem precisar
  registrar rota nenhuma em `core/urls.py` nem tocar no `ROOT_URLCONF` global,
  só para provar que o mixin em si funciona isolado do resto da API.
- Usuário A cria 2 `Talhao`; usuário B cria 1 `Talhao`. Uma requisição
  autenticada como A na listagem retorna só os 2 talhões de A.
- Uma requisição autenticada como B pedindo o ID de um talhão de A retorna
  `404` (não `403`, não os dados).

## Fora de escopo (nesta spec)

- Endpoint de registro público.
- Rate limiting no login (Task #9 — deploy).
- Reset/troca de senha.
- Os viewsets de verdade de cada app (`Talhao`, `Plantio`, `Insumo` etc.) —
  isso é a Task #6, que vai herdar `UsuarioScopedQuerySetMixin` construído
  aqui.
- CORS (`django-cors-headers`) — necessário para o frontend cross-origin
  funcionar de verdade, mas é configuração de deploy/ambiente, não parte da
  lógica de autenticação em si; entra quando o frontend (Task #8) ou o
  deploy (Task #9) precisar dele.
