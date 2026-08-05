# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Produtor rural de pequeno/médio porte (pimentão, tomate, batata), meia-idade
ou mais, pouco à vontade com apps — este não é um usuário técnico. Ele hoje
controla plantio, aplicação de defensivos/adubo e finanças da lavoura de
forma manual (caderno ou memória). Usa o app principalmente no celular, no
campo, durante o trabalho do dia a dia — não em desktop/tablet com calma.
Confirmado com o usuário (2026-08-05): densidade de informação baixa, texto
claro e direto, alvos de toque grandes são prioridade sobre convenções de UI
mais densas/modernas.

## Product Purpose

Substituir o caderno/memória do produtor por uma ferramenta digital simples
de gestão agrícola: acompanhar o ciclo de cada plantio (dias decorridos,
fase atual), registrar aplicações de insumos e saber quando é seguro
colher (período de carência), controlar tarefas com notificação no dia
certo, e ter controle financeiro (custo/receita) por plantio. Sucesso =
o produtor confia no app o suficiente pra abandonar o caderno.

## Positioning

Deliberadamente mais simples que um ERP agrícola: **sem** cálculo
automático de dosagem por área (o usuário só registra o que já decidiu
aplicar) e **sem** alerta automático vinculado à fase da cultura (o
sistema só mostra em que fase o plantio está; toda tarefa é criada
manualmente pelo usuário, com a data que ele escolher). A simplicidade é
uma escolha confirmada com o usuário final, não uma limitação técnica —
outras ferramentas do mercado tentam ser completas e acabam complexas
demais para esse perfil de usuário.

## Operating Context

Uso no campo, via celular, muitas vezes com as mãos sujas/luvas, sob sol
(tela precisa de bom contraste), entre outras tarefas do trabalho —
sessões curtas e interrompidas, não sentado numa mesa com calma. Sempre
online (sem exigência de modo offline, RNF02). Um usuário por conta hoje
(RNF01), mas a arquitetura já é multi-tenant (RNF07) pensando em
evolução futura. Idioma: português do Brasil, único suportado (RNF05).
Termos de domínio usados no app: talhão, plantio, cultura, insumo
(defensivo/adubo), carência, diária, safra.

## Capabilities and Constraints

- RF01–RF13 (ver `docs/requirements.md`) já implementados: cadastro de
  propriedade/talhão/cultura/plantio, catálogo de insumos, registro de
  aplicação, cálculo de dias restantes e data segura de colheita,
  lançamentos financeiros por plantio/setor, registro de colheita por
  classificação, tarefas manuais com notificação push no dia, painel
  geral (dashboard) com tarefas pendentes agrupadas por talhão,
  autenticação JWT com isolamento de dados por conta.
- PWA instalável (fatia 5/5 recém-mergeada): ícone/marca real (folha
  branca sobre verde `#166534`), prompt de instalação nativo do
  navegador. **Sem shell offline** — RNF02 já fechou isso, não
  redecidir sem novo ADR.
- Stack existente (não greenfield): Django REST Framework (backend),
  React + Vite + TypeScript + Tailwind CSS v4 (frontend), PostgreSQL em
  produção/SQLite em dev, JWT via `djangorestframework-simplejwt`.
- Fora de escopo confirmado: cálculo automático de dosagem por área,
  alertas automáticos vinculados à fase, modo offline, múltiplos
  idiomas, previsão climática, rastreabilidade para certificação.
- Deploy (Task #9 — Render/Railway, Vercel, Neon/Supabase) ainda não
  feito; app roda hoje só em ambiente de desenvolvimento local.

## Brand Commitments

Marca visual estabelecida na fatia 5/5 (ícones PWA, 2026-08-05): folha
branca estilizada sobre fundo verde `#166534` (verde do tema já em uso
em `theme-color`/manifest desde a fatia 1). Este verde e este símbolo
(folha/broto) já são um compromisso visual confirmado — qualquer
trabalho de design segue a partir daqui, não substitui sem decisão
explícita do usuário.

## Evidence on Hand

Nenhum dado real de produção ainda (projeto em desenvolvimento local,
Task #9/Deploy pendente). Nenhum testimonial, case, ou dado de uso real
— não fabricar nenhum desses no trabalho de design.

## Product Principles

1. Simplicidade extrema vence recursos — cada tela deve ser usável por
   alguém sem prática com apps, com pouca leitura e decisões óbvias.
2. O usuário decide, o sistema não decide por ele — sem cálculo
   automático de dosagem, sem alerta automático de fase; o app informa,
   quem age é o produtor.
3. Feito pra ser usado em movimento, no campo — não uma ferramenta de
   escritório. Toque grande, contraste alto, fluxos curtos.
4. Dado do produtor pertence ao produtor — isolamento estrito por conta
   (RF13), sem exigir mais dado pessoal do que o necessário (LGPD,
   `docs/threat-model.md`).
5. Duplo propósito do projeto: ferramenta real de uso do produtor E peça
   de portfólio que demonstra processo de arquitetura documentado — a
   qualidade do design final importa tanto quanto a funcionalidade.

## Accessibility & Inclusion

Usuário primário não é tecnicamente experiente e usa o app majoritariamente
ao ar livre (sol forte, possíveis luvas/mãos sujas) — isso implica
necessidade real de: alto contraste, alvos de toque grandes (bem acima do
mínimo de 44px), texto legível sem precisar aproximar a tela, e fluxos que
toleram interrupção (sessões curtas). Nenhum requisito formal de
acessibilidade (WCAG específico) foi estabelecido além dessas
necessidades observadas do usuário real.
