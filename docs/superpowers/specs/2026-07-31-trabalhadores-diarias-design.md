# Trabalhadores e Diárias — Design

## Contexto e motivação

O produtor pagou pelos serviços de diferentes trabalhadores, geralmente com
diária diferente por pessoa, e o pagamento normalmente acontece semanalmente
(soma das diárias trabalhadas na semana), não dia a dia. Hoje `finance` só
tem `LancamentoFinanceiro` com um `setor` genérico `"mao_de_obra"` — isso
cobre um lançamento avulso, mas obriga o produtor a somar as diárias de
cabeça e digitar tudo em texto livre na `descricao`.

Esta spec cobre o cadastro de trabalhadores com valor de diária próprio, o
registro diário de "esse trabalhador fez diária hoje", e a conversão desse
acúmulo em um `LancamentoFinanceiro` de verdade quando o produtor for pagar.

Esta é uma extensão do app `finance` já existente (models: `Trabalhador`,
`Diaria`), não um app novo — mão de obra já é um dos setores de
`LancamentoFinanceiro`, e são apenas dois models pequenos, fortemente
acoplados ao que já existe ali.

## Decisões já validadas com o usuário

- Toda `Diaria` é vinculada a um plantio específico (mantém o mesmo
  princípio que já vale para `LancamentoFinanceiro`: todo gasto pertence a
  um plantio, alimentando o custo por safra).
- O pagamento é uma ação explícita ("pagar diárias pendentes"), não um
  cálculo mostrado só na tela — o sistema cria o(s) `LancamentoFinanceiro`
  de verdade.
- Um trabalhador pode ter diárias pendentes em plantios diferentes na mesma
  leva de pagamento; a ação agrupa automaticamente por plantio e gera um
  `LancamentoFinanceiro` por plantio.
- O valor da diária é copiado para o registro no momento em que a diária é
  marcada (não recalculado a partir do cadastro do trabalhador depois) —
  reajustes futuros no valor do trabalhador não afetam diárias já
  registradas e ainda não pagas.

## Arquitetura

Dois models novos em `finance/models.py`, seguindo o mesmo padrão já usado
por `inputs.Insumo` / `inputs.AplicacaoInsumo` (catálogo reutilizável +
registro de uso com FK `PROTECT` para preservar trilha):

```
Trabalhador (usuario, nome, valor_diaria, ativo)
    ↑ PROTECT
Diaria (trabalhador, plantio, data, valor, lancamento?)
    ↑ PROTECT              → SET vinculado após pagamento (ver abaixo)
Plantio                     LancamentoFinanceiro
```

Uma função de serviço `finance/services.py::pagar_diarias_pendentes` faz a
conversão diárias → lançamento(s). Não é cálculo puro (lê e grava no banco),
então não entra em `domain/` — mora junto do app que a usa, como uma camada
de serviço que a API (Task #6, ainda não implementada) vai chamar depois.

## Componentes

### `Trabalhador`

Catálogo de trabalhadores do produtor, reutilizável entre plantios/safras.

| Campo | Tipo | Observação |
|---|---|---|
| `usuario` | FK `settings.AUTH_USER_MODEL`, `CASCADE` | Cada produtor tem seu próprio cadastro — mesmo padrão de `Insumo.usuario`. |
| `nome` | `CharField` | |
| `valor_diaria` | `DecimalField(10,2)` | Valor padrão atual; usado para pré-preencher novas diárias. |
| `ativo` | `BooleanField(default=True)` | "Desliga" um trabalhador que não trabalha mais sem apagar o histórico de diárias/pagamentos dele. |

### `Diaria`

Um registro de "este trabalhador fez uma diária neste dia, neste plantio".

| Campo | Tipo | Observação |
|---|---|---|
| `trabalhador` | FK `Trabalhador`, `PROTECT` | Não deixa apagar um trabalhador com diária registrada — usar `ativo=False` em vez de deletar. |
| `plantio` | FK `plantings.Plantio`, `PROTECT` | Mesma razão do `AplicacaoInsumo.plantio` (ADR 007): não deixa a trilha sumir apagando o plantio — usar `Plantio.status="cancelado"`. |
| `data` | `DateField` | |
| `valor` | `DecimalField(10,2)` | Cópia de `trabalhador.valor_diaria` no momento da criação — congelado, não recalculado. |
| `lancamento` | FK `LancamentoFinanceiro`, `null=True, blank=True`, `PROTECT` | `None` enquanto pendente. Preenchido pela ação de pagamento. `PROTECT` porque, uma vez a diária estiver vinculada a um lançamento, apagar esse lançamento não pode silenciosamente "despagar" a diária. |

**Restrição de unicidade:** `unique_together = ("trabalhador", "data")` — no
máximo uma diária por trabalhador por dia. Se o trabalhador dividir o dia
entre dois plantios, isso fica fora de escopo por ora (mesmo espírito da
decisão já tomada de não ter cálculo automático de dosagem: o sistema
registra o essencial, sem granularidade de meio-dia).

Estado "pago" é derivado (`lancamento_id is not None`), sem campo booleano
redundante.

### `pagar_diarias_pendentes(trabalhador)`

Função de serviço em `finance/services.py`:

1. Busca `Diaria.objects.filter(trabalhador=trabalhador, lancamento__isnull=True)`.
2. Agrupa os resultados por `plantio`.
3. Para cada grupo, cria um `LancamentoFinanceiro` com `setor="mao_de_obra"`,
   `valor` = soma dos `valor` das diárias do grupo, `data` = hoje,
   `descricao` = `f"Pagamento de diárias - {trabalhador.nome} ({data_mais_antiga} a {data_mais_recente})"`,
   usando a menor e a maior `data` das diárias daquele grupo — assim o
   lançamento já mostra o período coberto, sem precisar abrir cada diária.
4. Atualiza cada `Diaria` do grupo com `lancamento` apontando para o
   `LancamentoFinanceiro` recém-criado.
5. Retorna a lista de `LancamentoFinanceiro` criados (útil para a API/testes
   confirmarem o resultado).

Se não houver diárias pendentes, a função não cria nada e retorna lista
vazia — não é um erro, apenas não há o que pagar.

## Fluxo de dados

```
Produtor marca diária (trabalhador, plantio, data)
    → Diaria criada com valor = trabalhador.valor_diaria (snapshot)
    (dias se acumulam, lancamento=None)

Produtor decide pagar (fim de semana)
    → pagar_diarias_pendentes(trabalhador)
        → agrupa Diaria pendentes por plantio
        → cria 1 LancamentoFinanceiro por plantio (setor=mao_de_obra)
        → vincula as Diaria àquele lancamento (passam a contar como pagas)
```

## Tratamento de erros / casos de borda

- Diária duplicada no mesmo (trabalhador, data): `IntegrityError` na
  constraint de unicidade — comportamento esperado, sem tratamento especial
  na camada de serviço (a API, na Task #6, decide como comunicar isso ao
  usuário).
- `pagar_diarias_pendentes` chamado sem diárias pendentes: retorna `[]`, não
  levanta exceção.
- Deletar um `Trabalhador` ou `Plantio` com `Diaria` associada: bloqueado
  pelo `PROTECT`, mesma UX de erro que já existe hoje para `Insumo`/`Plantio`
  em `AplicacaoInsumo`.
- Deletar um `LancamentoFinanceiro` vinculado a `Diaria` paga: bloqueado pelo
  `PROTECT` em `Diaria.lancamento`.

## Testes previstos

Novo arquivo `lagoagro/tests/test_finance_trabalhadores_diarias.py`:

- `Trabalhador` pertence a um usuário.
- `Diaria` criada com `valor` igual ao `valor_diaria` do trabalhador no
  momento da criação.
- Alterar `trabalhador.valor_diaria` depois de criar uma `Diaria` não muda o
  `valor` já gravado nessa `Diaria` (prova que é cópia, não referência
  viva).
- Criar duas `Diaria` para o mesmo (trabalhador, data) levanta
  `IntegrityError`.
- `pagar_diarias_pendentes` com diárias pendentes em um único plantio: cria
  um `LancamentoFinanceiro` com o valor somado correto, `setor="mao_de_obra"`,
  e todas as diárias passam a apontar para ele.
- `pagar_diarias_pendentes` com diárias pendentes em dois plantios
  diferentes: cria dois `LancamentoFinanceiro` (um por plantio), cada um com
  a soma correta do seu grupo.
- `pagar_diarias_pendentes` sem diárias pendentes: retorna lista vazia, não
  cria nenhum `LancamentoFinanceiro`.
- Deletar `Trabalhador` com `Diaria` associada levanta `ProtectedError`.
- Deletar `Plantio` com `Diaria` associada levanta `ProtectedError`.

## Fora de escopo (nesta spec)

- Endpoint/view/serializer para acionar `pagar_diarias_pendentes` — isso é
  Task #6 (API DRF), ainda não iniciada.
- Diária fracionada entre múltiplos plantios no mesmo dia.
- Edição/estorno de diária já paga (desvincular de um lançamento).
- Notificação/lembrete de pagamento pendente — tarefas (`Tarefa`) já cobrem
  esse caso de forma manual, se o produtor quiser criar uma.
