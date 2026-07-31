# ADR 003 — Autenticação via JWT em vez de sessão Django

## Status
Aceito

## Contexto
O frontend (React) é desacoplado do backend (Django) e será hospedado em
domínio/serviço diferente (Vercel vs Render). Sessões tradicionais do Django
dependem de cookies do mesmo domínio e complicam CORS entre origens diferentes.
O sistema também precisa evoluir para multi-tenant (ADR 002), o que se beneficia
de autenticação stateless.

## Decisão
Usar JWT (via `djangorestframework-simplejwt`):
- Access token de curta duração (ex.: 15 min).
- Refresh token de duração maior (ex.: 7 dias), armazenado com HttpOnly cookie
  (não em localStorage, para reduzir risco de XSS roubar o token).
- Toda rota da API exige o access token, exceto login/registro.

## Consequências
- Positivo: frontend e backend totalmente desacoplados, sem dependência de
  cookie de sessão same-site.
- Positivo: modelo já compatível com apps mobile futuros, se surgirem.
- Atenção: expiração curta do access token exige fluxo de refresh no frontend
  (interceptor de requisição) — vira parte do checklist de segurança.
