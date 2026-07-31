# ADR 006 — Verificação diária de tarefas via job agendado simples

## Status
Aceito

## Contexto
O push notification (ADR 005) precisa ser disparado automaticamente quando uma
tarefa vence "no dia". Isso exige algum mecanismo de execução agendada
(scheduler), independente de uma requisição HTTP de usuário. As opções
avaliadas:

- **Celery + Redis**: robusto e escalável, mas adiciona dois serviços extras
  de infraestrutura (broker + worker) — over-engineering para o volume
  esperado (RNF01) e conflita com o objetivo de custo zero (RNF04).
- **APScheduler embutido no processo Django**: simples, mas depende do
  processo web ficar sempre ativo — free tiers de hospedagem costumam
  "dormir" a aplicação após inatividade, o que quebraria o agendamento.
- **Cron externo (GitHub Actions agendado ou Render Cron Job) chamando um
  endpoint/management command Django**: sem serviço adicional para manter,
  roda independentemente do estado do servidor web, gratuito nos dois casos.

## Decisão
Usar um **management command Django** (`python manage.py enviar_notificacoes_do_dia`)
que verifica todas as tarefas com vencimento igual à data atual e dispara o
push notification correspondente. Esse comando é executado uma vez por dia por
um **cron externo gratuito** (GitHub Actions agendado, chamando um endpoint
protegido por chave secreta, ou o Cron Job nativo do provedor de hospedagem).

## Consequências
- Positivo: nenhum serviço de infraestrutura adicional (sem Redis, sem
  worker dedicado).
- Positivo: fácil de testar isoladamente — o management command é uma função
  Python comum, testável sem precisar de um scheduler real rodando.
- Negativo: execução limitada à granularidade do cron (uma vez ao dia) — para
  o caso de uso ("notificar no dia da tarefa"), isso é suficiente e não
  representa uma limitação real.
- Atenção de segurança: se o disparo for via endpoint HTTP, ele precisa ser
  protegido por uma chave secreta (não pode ser um endpoint público sem
  autenticação) — ver `threat-model.md`.
