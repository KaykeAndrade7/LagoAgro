# ADR 004 — Stack tecnológica

## Status
Aceito

## Contexto
Time de 1 desenvolvedor, orçamento zero, prazo flexível, objetivo duplo
(ferramenta real + peça de portfólio).

## Decisão
- **Backend**: Django + Django REST Framework — admin pronto para cadastro
  rápido de culturas/insumos, ORM adequado ao domínio relacional, ecossistema
  maduro de testes.
- **Banco**: PostgreSQL (produção via Neon/Supabase; SQLite apenas em
  desenvolvimento local).
- **Frontend**: React + Vite + TailwindCSS — SPA simples, mobile-first, sem
  necessidade de SSR (não há requisito de SEO).
- **Deploy**: backend em Render/Railway, frontend em Vercel, banco em
  Neon/Supabase — todos com camada gratuita suficiente para o volume esperado
  (RNF01, RNF04).
- **CI**: GitHub Actions rodando testes automatizados a cada push.

## Consequências
- Positivo: stack 100% gratuita e amplamente documentada, reduz tempo perdido
  com infraestrutura.
- Positivo: separação clara de responsabilidades (API stateless + SPA) facilita
  demonstrar arquitetura em entrevista.
- Negativo: dois deploys separados (frontend/backend) exigem configurar CORS
  corretamente — documentado no threat model.
