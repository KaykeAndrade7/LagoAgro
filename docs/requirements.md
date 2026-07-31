# Requisitos — AgroGestor

## 1. Contexto do problema

Pequenos e médios agricultores controlam plantio, aplicação de defensivos/adubo e
finanças da lavoura de forma manual (caderno ou memória), o que gera:

- Desperdício ou subdosagem de insumos por cálculo impreciso.
- Perda de prazos de manejo (adubação de cobertura, colheita).
- Falta de controle sobre o período de carência de defensivos antes da colheita.
- Ausência de controle de custo/lucro por talhão e por safra.

## 2. Objetivo do produto

Fornecer uma ferramenta simples que:

1. Acompanhe o ciclo de cada plantio (dias decorridos, fase atual, tarefas pendentes).
2. Calcule automaticamente a quantidade de insumo necessária a partir da área do talhão.
3. Registre aplicações e alerte sobre o período de carência antes da colheita.
4. Controle custo e receita por plantio/safra.

## 3. Requisitos funcionais (RF)

> Revisado após entrevista com o usuário final (agricultor). Ver seção 7 para
> o histórico da mudança.

| ID | Descrição |
|----|-----------|
| RF01 | Cadastrar propriedade e talhões (nome, área, tipo de solo) |
| RF02 | Cadastrar culturas com ciclo em dias e fases (plantio, cobertura, floração, colheita). MVP: pimentão, tomate, batata |
| RF03 | Registrar um plantio (talhão + cultura + data) |
| RF04 | Calcular automaticamente dias restantes até colheita e exibir a fase atual do plantio |
| RF05 | Cadastrar produtos (defensivos/adubos) uma única vez em catálogo reutilizável |
| RF06 | Registrar aplicação de insumo: produto do catálogo + quantidade usada + data (registro manual, sem cálculo automático de dosagem) |
| RF07 | Calcular data segura de colheita (última aplicação + carência do produto) |
| RF08 | Registrar lançamentos financeiros (gasto) por plantio, classificado por setor (mão de obra, insumos, maquinário/equipamentos, transporte/frete, manutenção/infraestrutura, outros) |
| RF09 | Registrar resultado da colheita por classificação (ex.: caixas de primeira, caixas de segunda) |
| RF10 | Criar tarefas manuais vinculadas a um plantio, com data definida pelo usuário |
| RF11 | Notificar o usuário no dia da tarefa (prioridade: aplicação de defensivo) |
| RF12 | Exibir painel geral com tarefas pendentes de todos os plantios, e permitir entrar em cada talhão separadamente |
| RF13 | Autenticar usuário e isolar dados por conta |

## 4. Requisitos não-funcionais (RNF)

| ID | Descrição | Decisão |
|----|-----------|---------|
| RNF01 | Usuários simultâneos | Baixíssimo volume (1 usuário no MVP, dezenas no futuro) |
| RNF02 | Conectividade | Sempre online — sem exigência de modo offline |
| RNF03 | Disponibilidade | Não crítica — downtime pontual é aceitável no MVP |
| RNF04 | Custo de infraestrutura | Zero — uso de free tiers (Render/Railway, Neon/Supabase, Vercel) |
| RNF05 | Idioma | PT-BR apenas |
| RNF06 | Dispositivo principal | Mobile-first (uso no campo, via celular) |
| RNF07 | Evolução | Deve suportar múltiplos usuários (multi-tenant) sem redesenho de banco |
| RNF08 | Segurança de dados | Conformidade básica com LGPD (dados pessoais e de localização) |
| RNF09 | Testabilidade | Regras de cálculo (ciclo, dosagem, carência) devem ser testáveis isoladamente do framework |

## 5. Fora de escopo (MVP)

- Modo offline / sincronização.
- Múltiplos idiomas.
- Previsão climática integrada (fica como evolução futura).
- Rastreabilidade para certificação (evolução futura).
- Cálculo automático de dosagem de insumo por área — **descoping confirmado
  pelo usuário final**: ele prefere apenas registrar o que já decidiu aplicar.
  Pode voltar como funcionalidade opcional em versão futura.
- Alertas automáticos vinculados à fase da cultura — o usuário quer apenas
  visualizar a fase atual; tarefas são criadas manualmente por ele (RF10).

## 6. Perguntas em aberto para revisão futura

- Fotos de aplicação como evidência? (relevante se for pra certificação)
- Classificações de colheita além de "primeira/segunda" variam por cultura?
  (a definir durante a modelagem de RF09)

## 7. Changelog de requisitos

### Entrevista com o usuário final — [data da conversa]

- Confirmado: cadastro de talhão não precisa de mais campos além dos já
  previstos (nome, área, tipo de solo).
- Confirmado: culturas do MVP são pimentão, tomate e batata (não mais
  milho/feijão genéricos).
- **Removido**: cálculo automático de dosagem de insumo por área (RF05
  original) — usuário prefere apenas registrar o que aplicou.
- **Removido**: alerta automático vinculado a fase da cultura — vira apenas
  exibição informativa da fase atual.
- **Adicionado**: tarefas manuais com notificação no dia (RF10/RF11) —
  prioridade declarada: aplicação de defensivo.
- **Adicionado**: registro de resultado da colheita por classificação (caixas
  de primeira/segunda) (RF09) — apareceu como uma das 3 prioridades do
  usuário, junto com controle financeiro e tarefas.
- Confirmado: controle financeiro e gestão de tarefas são **ambos** prioritários
  (não um em detrimento do outro).
- Confirmado: abordagem incremental — lançar versão simples e evoluir.

### Nova ideia do usuário — 2026-07-31

- **Adicionado**: lançamentos financeiros (RF08) passam a ser classificados por
  setor de gasto, com destaque para mão de obra (pagamento de trabalhadores)
  como categoria própria, além de insumos, maquinário/equipamentos,
  transporte/frete, manutenção/infraestrutura e outros. Lista genérica,
  pensada para cobrir os gastos de uma pequena propriedade sem precisar de um
  catálogo configurável à parte.
