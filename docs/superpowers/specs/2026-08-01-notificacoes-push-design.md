# Design — Job de notificação diária + Web Push (Task #7)

## Contexto

RF11 exige notificar o usuário no dia de uma tarefa. ADR 005 já decidiu o
canal (Web Push via PWA) e ADR 006 já decidiu o mecanismo de disparo
(management command Django, executado por cron externo — GitHub Actions ou
Cron Job nativo do provedor — chamando um endpoint protegido por chave
secreta). O `threat-model.md` já especifica a mitigação de segurança desse
endpoint (chave no header, comparada com `secrets.compare_digest`).

Este documento cobre a implementação backend dessas decisões. **Fora de
escopo**: geração das chaves VAPID reais, workflow do GitHub Actions e
qualquer configuração de cron real — isso fica para o Task #9 (Deploy),
quando o ambiente de hospedagem existir de fato. Este trabalho entrega a
capacidade completa e testável, inerte até ser acionada em produção.

## Decisões de abordagem

**Biblioteca: `pywebpush`**, não `django-webpush`. ADR 005 já lista ambas
como aceitáveis ("biblioteca compatível com Web Push (ex.: `django-webpush`
ou envio direto via VAPID)"). `django-webpush` traz modelo e views próprios
que não seguem o padrão já estabelecido no projeto (FK-scoping em
`serializer.__init__` + `UsuarioScopedQuerySetMixin`, ver ADR de
`docs/superpowers/specs/2026-07-31-drf-viewsets-por-app-design.md`).
`pywebpush` é só uma função de envio (VAPID + payload) — o modelo e os
endpoints continuam sendo nossos, com controle total e consistência com o
resto da API.

**App novo: `notifications/`**, não dentro de `tasks/`. Uma subscription de
push é um registro de dispositivo em nível de conta, não um conceito
específico de `Tarefa` — a mesma subscription serviria qualquer tipo futuro
de notificação. Consistente com o espírito de monólito modular do ADR 001.

## Modelo de dados

```python
# notifications/models.py
class PushSubscription(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    criado_em = models.DateTimeField(auto_now_add=True)
```

`endpoint` é globalmente único (é uma URL gerada pelo push service do
navegador). O registro é feito via `update_or_create(endpoint=...)` — não um
`create()` simples — para cobrir dois casos legítimos sem violar a
constraint: o mesmo navegador reemitindo a mesma subscription (ex.: o
service worker é reinstalado) e um dispositivo compartilhado trocando de
conta (a subscription antiga é realocada para o novo `usuario`, não
duplicada).

**Alteração em `Tarefa` (idempotência):** adicionar
`notificado_em = models.DateTimeField(null=True, blank=True)`. O disparo
pode legitimamente acontecer mais de uma vez no mesmo dia (re-execução
manual, retry de cron) — sem esse campo, isso reenviaria a mesma notificação
duas vezes. O serviço só considera elegível uma tarefa cujo `notificado_em`
é nulo ou é de um dia anterior ao atual, e marca o campo após o envio ter
sucesso para ao menos uma subscription (ou mesmo sem nenhuma subscription
ativa — a tarefa não deve ficar "pendente para sempre" só porque o usuário
não tem dispositivo registrado naquele dia).

## API de registro (consumida pelo Task #8 no futuro)

`PushSubscriptionViewSet`, registrado no `DefaultRouter` existente em
`core/urls.py` como `push-subscriptions`, seguindo exatamente o padrão dos
outros 11 viewsets do projeto:

- `UsuarioScopedQuerySetMixin` com `usuario_lookup="usuario"`.
- `usuario` não é exposto no serializer — atribuído no servidor.
- `perform_create` é sobrescrito (em vez do padrão
  `serializer.save(usuario=self.request.user)` usado nos outros apps) para
  fazer o `update_or_create` por `endpoint` descrito acima — é o único
  ponto do projeto que precisa desse comportamento, então fica documentado
  aqui como desvio deliberado do padrão, não inconsistência.
- Suporta `list` (ver as próprias subscriptions), `create` (registrar) e
  `destroy` (desregistrar, ex.: no logout ou ao revogar permissão no
  navegador).

## Endpoint de disparo

`POST /api/notificacoes/disparar/` — `APIView` simples (fora do router),
sem autenticação JWT (`authentication_classes = []`,
`permission_classes = [AllowAny]`), porque quem chama é um cron externo, não
um usuário logado. Protegido por header `X-Notification-Secret`, comparado
com `settings.NOTIFICATION_TRIGGER_SECRET` via `secrets.compare_digest`
(nunca comparação direta com `==`, para evitar timing attack — igual já
determinado em `threat-model.md`).

**Fail closed:** se `NOTIFICATION_TRIGGER_SECRET` estiver vazio/não
configurado no ambiente, o endpoint rejeita *toda* requisição com 403 — nunca
cai em "aceitar sem checar" só porque a env var não foi setada. Isso importa
porque em dev local a env var normalmente não existe.

Resposta: `{"tarefas_notificadas": N, "subscriptions_removidas": M}`.

## Serviço de envio

`notifications/services.py::enviar_notificacoes_do_dia(hoje=None) -> dict`

```python
def enviar_notificacoes_do_dia(hoje=None):
    hoje = hoje or timezone.localdate()
    tarefas = (
        Tarefa.objects
        .filter(concluida=False, data=hoje, plantio__talhao__propriedade__usuario__is_active=True)
        .filter(Q(notificado_em__isnull=True) | Q(notificado_em__date__lt=hoje))
        .select_related("plantio__talhao__propriedade__usuario")
    )
    tarefas_notificadas = 0
    removidas = 0
    for tarefa in tarefas:
        usuario = tarefa.plantio.talhao.propriedade.usuario
        subscriptions = list(usuario.push_subscriptions.all())
        pelo_menos_um_sucesso = False
        for subscription in subscriptions:
            enviado, stale = _enviar_push(subscription, tarefa)
            if enviado:
                pelo_menos_um_sucesso = True
            if stale:
                subscription.delete()
                removidas += 1
        if not subscriptions or pelo_menos_um_sucesso:
            tarefa.notificado_em = timezone.now()
            tarefa.save(update_fields=["notificado_em"])
            if pelo_menos_um_sucesso:
                tarefas_notificadas += 1
    return {"tarefas_notificadas": tarefas_notificadas, "subscriptions_removidas": removidas}
```

`_enviar_push` chama `pywebpush.webpush(...)` dentro de um `try/except
WebPushException`. Um `404`/`410` na resposta significa que o push service
do navegador considera a subscription permanentemente inválida →
`stale=True`, a subscription é apagada. Qualquer outro erro (rede, 5xx
temporário do push service) → `stale=False`, a subscription é mantida e a
tentativa simplesmente não conta como enviada.

**Correção em relação ao design original (Task 4):** a primeira versão deste
pseudocódigo marcava `notificado_em` incondicionalmente após o loop de
subscriptions, e a versão anterior deste documento argumentava que isso era
aceitável porque "RF11 é 'notificar no dia', não 'garantir entrega'". Isso
foi revisto durante a implementação (commits `a33ab9b` e `dce195e` neste
worktree): marcar `notificado_em` mesmo quando todos os envios falharem
faria uma falha transitória (rede, 5xx temporário do push service) perder
silenciosa e permanentemente a notificação daquele dia — `Tarefa.data` é um
campo fixo, não recorrente, então não existe um "outro dia" em que a tarefa
volte a ficar elegível. Por isso `notificado_em` só é setado quando não há
subscriptions (nada a enviar) ou quando pelo menos um envio teve sucesso;
falha total mantém a tarefa elegível para retry no mesmo dia, no próximo
disparo do cron.

**Chamadores:**
- `python manage.py enviar_notificacoes_do_dia` (management command, útil
  para rodar localmente ou se o provedor de deploy tiver cron nativo).
- O `APIView` de disparo acima (para GitHub Actions).

Ambos chamam a mesma função de serviço — nenhuma lógica duplicada.

## Settings

```python
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIM_EMAIL = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:admin@example.com')
NOTIFICATION_TRIGGER_SECRET = os.environ.get('NOTIFICATION_TRIGGER_SECRET', '')
```

Mesmo padrão de fallback vazio/inseguro-mas-funcional já usado para
`SECRET_KEY`. `notifications` adicionado a `INSTALLED_APPS`. Nova
dependência: `pywebpush` em `pyproject.toml`.

## Testes

- `notifications/tests` (ou `lagoagro/tests/test_notifications_views.py`,
  seguindo a convenção de um arquivo por app já usada no Task #6):
  CRUD escopado por usuário, 404 cross-tenant, `update_or_create` na
  re-registração do mesmo `endpoint`, 401 sem token.
- `lagoagro/tests/test_notifications_services.py`: `pywebpush.webpush`
  mockado — envia só para tarefas de hoje não concluídas, pula tarefas já
  notificadas hoje, envia para todas as subscriptions do usuário, apaga
  subscription em 410 simulado, mantém subscription em erro simulado
  diferente de 404/410, idempotência (rodar duas vezes no mesmo dia não
  duplica envio).
- `lagoagro/tests/test_notifications_trigger_view.py`: secret válido → 200 e
  serviço chamado; header ausente → 403; secret errado → 403; secret não
  configurado no settings → sempre 403.
- Teste do management command via `call_command`, serviço mockado.

## Fora de escopo (Task #9)

- Geração das chaves VAPID reais.
- Workflow do GitHub Actions agendado.
- Configuração do `NOTIFICATION_TRIGGER_SECRET` real em produção.
