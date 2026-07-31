# ADR 001 — Monolito modular em vez de microsserviços

## Status
Aceito

## Contexto
O sistema é desenvolvido por uma única pessoa, para um único usuário inicial,
com domínio ainda pequeno (talhões, plantios, insumos, financeiro). Microsserviços
trazem complexidade operacional (deploy independente, comunicação entre serviços,
observabilidade distribuída) que não se paga em um projeto desse porte.

## Decisão
Construir um **monolito modular**: uma única aplicação Django, mas organizada em
apps internos com responsabilidades bem separadas (`properties`, `crops`,
`plantings`, `inputs`, `finance`), e com a lógica de cálculo isolada em um módulo
`domain/` sem dependência do framework.

## Consequências
- Positivo: deploy único, mais simples de manter e testar sozinho.
- Positivo: separação por módulo já prepara uma eventual extração futura para
  serviços independentes, se o projeto crescer muito (a fronteira já existe no
  código, só não existe fisicamente).
- Negativo: escalabilidade horizontal por módulo não é possível sem refatoração
  futura — aceitável dado o volume de uso esperado (RNF01).
