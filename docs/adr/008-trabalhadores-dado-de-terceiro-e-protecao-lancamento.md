# ADR 008 — Dado pessoal de terceiro (Trabalhador) e extensão do PROTECT a LancamentoFinanceiro

## Status
Aceito

## Contexto

A revisão final da branch `trabalhadores-diarias` (models `Trabalhador`/`Diaria`
e serviço `pagar_diarias_pendentes`, ver
`docs/superpowers/specs/2026-07-31-trabalhadores-diarias-design.md`) levantou
dois pontos que a ADR 007 não previa, por terem surgido de uma feature nova:

1. **`Trabalhador.nome` é dado de uma pessoa que não é o dono da conta.** A
   ADR 007 (Parte 2) justificou que "exclusão de conta" via anonimização é
   suficiente porque "dados de propriedade/plantio neste sistema não carregam
   identificação pessoal além do que já está no próprio `Usuario`". Essa
   premissa deixou de valer estritamente: `Trabalhador.nome` identifica um
   terceiro (o trabalhador contratado), e esse nome também é copiado para
   `LancamentoFinanceiro.descricao` quando `pagar_diarias_pendentes` gera o
   pagamento.
2. **Inconsistência entre `Diaria.plantio` (PROTECT) e
   `LancamentoFinanceiro.plantio` (CASCADE, já existente desde antes desta
   branch).** Um plantio com diária registrada não pode ser apagado
   diretamente, mas um plantio só com lançamentos financeiros (sem diária)
   ainda perde todo o histórico financeiro se for deletado — o mesmo tipo de
   trilha de auditoria que a ADR 007 já protegeu para `AplicacaoInsumo` fica
   desprotegida aqui por um detalhe de que o modelo é mais antigo que a regra.

## Decisão

### Parte 1 — Trabalhador.nome permanece como está, sem anonimização adicional

Decisão do usuário final: o campo é só o nome ou apelido pelo qual o
produtor identifica o trabalhador no dia a dia (não exige nome completo,
CPF, endereço ou qualquer outro dado sensível) — o risco de exposição é
baixo o suficiente para não justificar tratamento equivalente ao dado do
dono da conta. **Não implementamos anonimização de `Trabalhador` no
`anonimizar_usuario`, nem removemos o nome de `LancamentoFinanceiro.descricao`.**
`RNF08` (threat-model.md) pede conformidade *básica* com LGPD, não o nível de
proteção reservado a dados sensíveis (saúde, biometria, etc.) — um
apelido/nome de uso interno se enquadra nesse nível básico.

Se no futuro o cadastro de `Trabalhador` ganhar campos adicionais (CPF,
endereço, telefone, PIX para pagamento), essa decisão deve ser revisitada em
um novo ADR — os campos atuais (`nome`, `valor_diaria`, `ativo`) não
justificam por si só o mesmo tratamento do dado do `Usuario`.

### Parte 2 — LancamentoFinanceiro.plantio passa a ser PROTECT

`LancamentoFinanceiro.plantio` muda de `on_delete=models.CASCADE` para
`on_delete=models.PROTECT`, pelo mesmo raciocínio já aplicado a
`AplicacaoInsumo.plantio` e `Diaria.plantio` na ADR 007: um plantio com
histórico financeiro registrado não pode ser apagado diretamente — o fluxo
esperado continua sendo `Plantio.status = "cancelado"` em vez de deletar.

## Consequências

- Positivo: as três trilhas de auditoria/financeiro ligadas a um plantio
  (`AplicacaoInsumo`, `Diaria`, `LancamentoFinanceiro`) agora seguem a mesma
  regra de proteção — nenhuma pode sumir apagando o plantio pai.
- Custo: um `Plantio` que só tem lançamentos financeiros (nenhuma aplicação
  nem diária) também deixa de poder ser apagado diretamente — precisa de
  migration (`AlterField`) e ajuste no teste que hoje assume cascata
  (`tests/test_tarefas_colheitas_financeiro_models.py`).
- Aceito como risco conhecido: `Trabalhador.nome` (e sua cópia em
  `LancamentoFinanceiro.descricao`) não passa por anonimização quando a conta
  do produtor é anonimizada — decisão consciente de MVP, não uma lacuna não
  percebida.
