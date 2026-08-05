# LagoAgro — Contexto do projeto

Leia este arquivo antes de qualquer tarefa. Ele resume as decisões de
arquitetura já tomadas. Não redecidir o que já está fechado aqui sem
justificativa nova — se algo precisar mudar, crie um novo ADR em `docs/adr/`
referenciando o anterior, não edite os ADRs existentes.

## O que é o projeto

Sistema de gestão agrícola simples para um pequeno produtor (pimentão, tomate,
batata), cobrindo: controle de talhões e plantios, registro de aplicação de
defensivos/adubos, cálculo de dias até a colheita e período de carência,
controle financeiro por plantio, tarefas com notificação, e registro de
colheita por classificação (caixas de primeira/segunda).

Duplo objetivo: ferramenta real para uso do produtor + projeto de portfólio
que demonstra processo de arquitetura documentado (ver `docs/`).

## Documentação de referência (leia antes de implementar)

- `docs/requirements.md` — requisitos funcionais (RF01–RF13) e não-funcionais,
  incluindo o changelog da entrevista com o usuário final
- `docs/adr/001-monolito-modular.md` até `006-job-agendado-notificacoes.md`
  — decisões de arquitetura já tomadas e seus porquês
- `docs/threat-model.md` — ameaças mapeadas e checklist de segurança

## Stack definida (não trocar sem novo ADR)

- **Backend**: Django + Django REST Framework
- **Banco**: PostgreSQL (SQLite só em dev local)
- **Frontend**: React + Vite + TailwindCSS, estruturado como **PWA**
  (manifest.json + service worker para push notification)
- **Autenticação**: JWT (`djangorestframework-simplejwt`), access curto +
  refresh em cookie HttpOnly
- **Notificação**: Web Push, disparada por management command Django
  executado via cron externo (não Celery/Redis)
- **Deploy alvo**: Render/Railway (backend), Vercel (frontend),
  Neon/Supabase (banco) — tudo free tier

## Estrutura de pastas do backend

```
lagoagro/
├── core/                  # config Django (auth JWT em auth_views.py, isolamento multi-tenant em permissions.py)
├── properties/            # Propriedade, Talhao
├── crops/                 # Cultura, FaseCultura
├── plantings/             # Plantio
├── inputs/                # Insumo, AplicacaoInsumo
├── tasks/                 # Tarefa
├── harvest/               # Colheita (classificação)
├── finance/               # LancamentoFinanceiro
├── notifications/         # PushSubscription, job diario de notificacao (ADR 006)
├── domain/                # lógica pura de cálculo, SEM dependência de Django
│   ├── cycle_calc.py      # dias restantes, fase atual
│   └── safety_calc.py     # data segura de colheita (carência)
└── tests/
```

Regra importante: `domain/` deve ser testável sem banco de dados e sem
Django rodando — são funções Python puras.

Frontend em frontend/ na raiz do repo (React + Vite + TypeScript + Tailwind, ver docs/superpowers/specs/2026-08-01-frontend-scaffold-auth-design.md).

## Regras de negócio já validadas com o usuário final

- **Sem** cálculo automático de dosagem por área — o usuário só registra o
  que já aplicou (produto + quantidade).
- **Sem** alerta automático vinculado à fase da cultura — o sistema só exibe
  em qual fase o plantio está.
- Tarefas são criadas manualmente pelo usuário, com data definida por ele.
- Notificação push deve chegar **no dia** da tarefa (não antes).
- Todo dado de domínio (Talhao, Plantio, Insumo, LancamentoFinanceiro etc.)
  deve ter `usuario_id` (ou herdar via `Propriedade`) e toda query deve
  filtrar pelo usuário autenticado — nunca confiar em ID vindo da URL sem essa
  checagem (ver `docs/threat-model.md`, ameaça IDOR).

## Entidades principais

```
Usuario
Propriedade (usuario) → Talhao (propriedade, nome, area, tipo_solo)
Cultura (nome, ciclo_dias) → FaseCultura (cultura, nome_fase, dia_inicio, dia_fim)
Insumo (usuario, nome, tipo[veneno|adubo], carencia_dias)
Plantio (talhao, cultura, data_plantio, status)
AplicacaoInsumo (plantio, insumo, data, quantidade)
Tarefa (plantio, descricao, data, concluida)
Colheita (plantio, data, classificacao, quantidade)
LancamentoFinanceiro (plantio, valor, data, descricao)
PushSubscription (usuario, endpoint, p256dh, auth)
```

## Convenção de commits

Este projeto usa **Conventional Commits**. Todo commit deve seguir:

```
<tipo>(<escopo>): <descrição curta no imperativo>
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`.
Escopos válidos (batem com a estrutura de pastas): `properties`, `crops`,
`plantings`, `inputs`, `tasks`, `harvest`, `finance`, `notifications`,
`domain`, `auth`, `frontend`, `adr`.

Exemplos:
- `feat(plantings): adicionar model Plantio com cálculo de dias restantes`
- `test(domain): cobrir casos de borda do cycle_calc`
- `docs(adr): registrar ADR 007 sobre paginação da API`

Regra: cada commit deve ser atômico (uma mudança coerente por commit) — não
misturar `feat` com `fix` não relacionado no mesmo commit.

## Status atual

Models de todas as entidades, autenticação JWT multi-tenant (`core/auth_views.py`,
`core/permissions.py`) e as regras de negócio de finance já estão implementados
e cobertos por testes. Consultar `docs/adr/` para o histórico de decisões e
`docs/requirements.md` para o que ainda falta por RF.

O backend de RF11 (job de Web Push, app `notifications`) está implementado e
testado, mas as chaves VAPID reais, o disparo via cron e o segredo de
produção ainda não foram configurados — único pedaço de RF11 ainda pendente.

**Task #9 (Deploy) concluída (2026-08-05):** app no ar em produção —
backend no Render (`render.yaml` na raiz, banco Postgres no Neon) e
frontend na Vercel (`https://lago-agro.vercel.app`). Variáveis de ambiente
de produção (`SECRET_KEY`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, etc.)
vivem só nos painéis do Render/Vercel, não no repo — ver `render.yaml` e
`frontend/.env.production.example` pra saber quais existem.
