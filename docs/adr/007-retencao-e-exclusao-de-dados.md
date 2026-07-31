# ADR 007 — Retenção e exclusão de dados (conta do usuário e trilha de auditoria)

## Status
Aceito

## Contexto
Ao modelar `AplicacaoInsumo` (ver plano `docs/superpowers/plans/2026-07-30-models-django.md`,
Task 4), duas escolhas de `on_delete` combinadas produziram um comportamento não
percebido até uma revisão de branch inteira:

1. `AplicacaoInsumo.created_by` e `AplicacaoInsumo.insumo` usavam `PROTECT`,
   enquanto `Insumo.usuario` usava `CASCADE`. Resultado: um usuário que já
   registrou qualquer aplicação de insumo **não podia ter a conta excluída**
   (o banco recusa o delete) — conflita diretamente com o compromisso do
   `threat-model.md` §4 de permitir exclusão de conta (LGPD).
2. `AplicacaoInsumo.plantio` usava `CASCADE`. Resultado: apagar um `Plantio`
   (ou seu `Talhao`/`Propriedade`) apaga em cascata a trilha de auditoria que
   o `threat-model.md` descreve como mitigação para Repudiation ("usuário
   nega ter feito determinada aplicação de insumo") — a trilha não sobrevive
   justamente à ação da pessoa contra quem ela deveria valer.

Cada escolha fazia sentido isolada; juntas, geravam um esquema incoerente.

## Decisão

### Parte 1 — on_delete dos FKs de AplicacaoInsumo
1. `AplicacaoInsumo.created_by` passa a ser `on_delete=models.SET_NULL,
   null=True`. Se algum dia a conta do usuário for removida por qualquer via
   (inclusive um `.delete()` direto no admin), o registro de aplicação
   sobrevive, só perde o vínculo com quem o criou.
2. `AplicacaoInsumo.plantio` passa a ser `on_delete=models.PROTECT`. Um
   plantio com aplicações registradas não pode mais ser apagado diretamente
   — o fluxo esperado é usar `Plantio.status = "cancelado"` (campo já
   existente) em vez de deletar. Isso torna a trilha de auditoria realmente
   imutável, como o comentário no código já afirmava.

### Parte 2 — "exclusão de conta" não é `.delete()`, é anonimização
Investigando a fundo (ver discussão do revisor de branch inteira do plano
`2026-07-30-models-django.md`): mesmo com a Parte 1 aplicada, um
`usuario.delete()` bruto continua falhando sempre que o usuário tiver
qualquer `Insumo` já aplicado (`AplicacaoInsumo.insumo` é `PROTECT`, e
precisa continuar sendo — um insumo em uso não pode sumir do catálogo) ou
qualquer `Plantio` com aplicação registrada (Parte 1, item 2, acima). Ou
seja: **cascata bruta nunca vai funcionar de verdade** para uma conta com
histórico de uso real, e tentar forçar isso mudando mais `on_delete`
destruiria justamente os dados que este ADR e o ADR 002 protegem.

A saída não é técnica de schema, é de processo: "excluir a conta" na prática
vira **anonimizar os dados pessoais do `Usuario`** (username, e-mail, nome,
senha) mantendo a conta e todo o histórico operacional (talhões, plantios,
aplicações, financeiro) intactos e associados a uma conta anônima. Dados de
propriedade/plantio neste sistema não carregam identificação pessoal alem
do que já está no próprio `Usuario` (`Propriedade.nome` é o nome da
propriedade, não do dono) — anonimizar o `Usuario` já resolve o requisito de
dado pessoal do `threat-model.md` (nome, e-mail).

Isso já era exatamente o que o `threat-model.md` §4 previa: "permitir que o
usuário solicite exclusão da própria conta e dados (**endpoint ou processo
manual documentado é suficiente no MVP**)" — não exigia `.delete()`
funcionar.

Implementação mínima para o MVP: management command
`anonimizar_usuario <id>` (app `core`, seguindo o mesmo padrão de comando
manual do ADR 006), que zera username/e-mail/nome e invalida a senha,
mantendo a linha do `Usuario` e todo o histórico ligado a ela.

## Consequências
- Positivo: a trilha de auditoria contra Repudiation não pode mais ser
  apagada pelo próprio usuário através de um caminho indireto (deletar o
  plantio), nem pela exclusão de conta.
- Positivo: "exclusão de conta" fica coerente com o resto do sistema (nada
  de esquema incoerente tentando fazer `.delete()` bruto funcionar).
- Custo: exclusão "de verdade" (remover a linha do banco) de um `Plantio`
  com histórico deixa de existir — a UI/API precisa oferecer "cancelar" em
  vez de "excluir" quando há aplicações registradas.
- Custo: `created_by` deixa de ser obrigatório — código futuro precisa
  tratar `None` (autor anonimizado ou removido).
- Pendência: o command `anonimizar_usuario` é operado manualmente (via
  `manage.py`) no MVP; um endpoint autenticado para o próprio usuário
  disparar isso fica para quando a API de auth (ADR 003) estiver pronta.
