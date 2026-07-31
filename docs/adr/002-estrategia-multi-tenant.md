# ADR 002 — Single-tenant funcional, multi-tenant estrutural

## Status
Aceito

## Contexto
O produto começa com um único usuário (RNF07 prevê expansão futura para vários
agricultores). Duas opções:

1. Construir sem conceito de usuário/dono nos dados, e adicionar isolamento
   depois.
2. Construir já com `usuario_id` em todas as tabelas relevantes, mesmo havendo
   um único usuário hoje.

A opção 1 é mais rápida no curtíssimo prazo, mas historicamente é a causa mais
comum de retrabalho doloroso e de falhas de segurança (dados de um usuário
vazando para outro) quando o sistema precisa virar multiusuário.

## Decisão
Toda tabela de domínio (Talhão, Plantio, Insumo, LançamentoFinanceiro) possui
`usuario_id` (ou `propriedade_id`, que por sua vez pertence a um usuário) desde
o primeiro schema. Toda query de leitura filtra obrigatoriamente por esse campo
a partir do usuário autenticado — nunca a partir de um ID recebido "solto" na
requisição, para evitar IDOR (ver `threat-model.md`).

## Consequências
- Positivo: liberar o sistema para outros agricultores no futuro não exige
  migração de schema nem reescrita de queries.
- Positivo: o isolamento de dados já é testado desde o início (mesmo com 1
  usuário, os testes simulam 2 contas para garantir que uma não vê dados da
  outra).
- Custo: exige disciplina de sempre filtrar por usuário autenticado em cada
  endpoint — mitigado com uma camada única de "queryset base" reutilizável no
  DRF (`get_queryset` filtrando por `request.user` em uma classe base).
