# ADR 009 — Exclusão irrestrita de Plantio, Trabalhador e LancamentoFinanceiro

## Status
Aceito

## Contexto

ADR 007 (Parte 1) e ADR 008 (Parte 2) estabeleceram `on_delete=PROTECT` em
`AplicacaoInsumo.plantio`, `Diaria.plantio`, `Diaria.trabalhador` e
`LancamentoFinanceiro.plantio`, com o objetivo de preservar trilha de
auditoria/pagamento contra a ameaça de Repudiation mapeada em
`threat-model.md` — o raciocínio original era que o dono da conta não
deveria conseguir apagar evidência de uma aplicação de insumo ou de um
pagamento só deletando o `Plantio` ou o `Trabalhador` pai.

Na prática (feedback do usuário final, 2026-08-05) isso virou um problema
de uso real, não hipotético: qualquer `Plantio` que já teve uma aplicação
de insumo, uma diária ou um lançamento financeiro registrado — ou seja,
praticamente todo plantio usado de verdade — ficava permanentemente
impossível de excluir pela UI, só "cancelável" (`Plantio.status =
"cancelado"`), o que nunca foi comunicado como o fluxo esperado em lugar
nenhum da interface. O mesmo bloqueio afetava excluir um `Trabalhador` com
diárias e excluir um `LancamentoFinanceiro` (gasto) que pagava diárias.
Questionado diretamente, o usuário confirmou: quer poder excluir qualquer
coisa que ele mesmo criou, sem exceção — inclusive registros já "fechados"
como uma diária paga.

Este é um app de uso pessoal de um único produtor (não multi-usuário
adversarial dentro da mesma conta) — a ameaça de Repudiation do
threat-model é sobre alguém negar uma ação própria perante si mesmo/terceiro
externo (ex.: fiscalização), não sobre proteger o dono da conta dos seus
próprios dados. Priorizar o controle do usuário sobre os próprios dados é
mais alinhado ao produto real do que a garantia de imutabilidade que a ADR
007/008 assumiu ser necessária.

## Decisão

Reverte a Parte 1 da ADR 007 e a Parte 2 da ADR 008:

- `AplicacaoInsumo.plantio`: `PROTECT` → `CASCADE`
- `Diaria.plantio`: `PROTECT` → `CASCADE`
- `Diaria.trabalhador`: `PROTECT` → `CASCADE`
- `LancamentoFinanceiro.plantio`: `PROTECT` → `CASCADE`

Um caso novo, não coberto pelas ADRs anteriores, também é resolvido aqui:

- `Diaria.lancamento`: `PROTECT` → `SET_NULL` (campo já era `null=True`).
  Diferente dos casos acima, aqui a escolha **não** é `CASCADE` — excluir o
  `LancamentoFinanceiro` (o "gasto" que registra o pagamento) não deve
  apagar a `Diaria` (o registro de que o trabalhador trabalhou naquele
  dia), só desfazer o vínculo de pagamento. A diária volta a aparecer como
  pendente, disponível para ser paga de novo via `pagar-diarias`. Excluir
  uma diária em si continua bloqueado enquanto ela tiver um lançamento
  vinculado (`DiariaViewSet.destroy`, regra de nível de view, não mudou) —
  a única forma de liberar a exclusão da diária é excluir o lançamento
  primeiro.

`AplicacaoInsumo.insumo` e `Plantio.cultura` continuam `PROTECT` — não
fazem parte do que o usuário reportou como quebrado, e protegem coisas
diferentes: `Insumo`/`Cultura` são catálogos, não dados descartáveis de um
plantio específico (excluir um plantio nunca deveria fazer o insumo ou a
cultura sumirem do catálogo do usuário).

## Consequências

- Positivo: `Plantio`, `Propriedade`/`Talhao` (que já cascateavam até
  `Plantio`), `Trabalhador` e `LancamentoFinanceiro` agora podem ser
  excluídos pela UI sem cair em 409, mesmo com histórico vinculado —
  resolve a reclamação real do usuário.
- Positivo: excluir um `LancamentoFinanceiro` gerado por `pagar-diarias`
  desfaz o pagamento (diária volta a pendente) em vez de deixar a diária
  paga apontando para um lançamento inexistente.
- Custo (aceito conscientemente): a mitigação de Repudiation descrita em
  `threat-model.md` para `AplicacaoInsumo` fica mais fraca — o dono da
  conta agora pode apagar a trilha de aplicação de insumo excluindo o
  plantio pai. Acionável apenas pelo próprio dono da conta sobre os
  próprios dados, não por um terceiro; risco aceito dado o contexto de uso
  (produtor único, sem necessidade de prova perante outra parte dentro do
  sistema).
- Custo: excluir um `Plantio`/`Trabalhador` agora é destrutivo e
  irreversível para todo o histórico financeiro/operacional vinculado a
  ele — não há mais uma rede de segurança de banco impedindo isso. A UI
  continua oferecendo `Plantio.status = "cancelado"` como alternativa não
  destrutiva; passa a ser responsabilidade do usuário escolher a ação
  certa (a confirmação de exclusão no frontend já avisa quantas diárias
  serão afetadas antes de excluir um lançamento).
- `threat-model.md` (linha da mitigação de Repudiation) e o comentário em
  `core/exceptions.py` foram atualizados para não descrever mais uma
  garantia de imutabilidade que não existe mais para estes três campos.
