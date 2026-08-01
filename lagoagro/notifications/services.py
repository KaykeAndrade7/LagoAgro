import json
import logging

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from pywebpush import WebPushException, webpush

from tasks.models import Tarefa

logger = logging.getLogger(__name__)


def enviar_notificacoes_do_dia(hoje=None):
    hoje = hoje or timezone.localdate()
    tarefas = (
        Tarefa.objects.filter(concluida=False, data=hoje, plantio__talhao__propriedade__usuario__is_active=True)
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
            enviado, expirada = _enviar_push(subscription, tarefa)
            if enviado:
                pelo_menos_um_sucesso = True
            if expirada:
                subscription.delete()
                removidas += 1
        if not subscriptions or pelo_menos_um_sucesso:
            tarefa.notificado_em = timezone.now()
            tarefa.save(update_fields=["notificado_em"])
            if pelo_menos_um_sucesso:
                tarefas_notificadas += 1

    return {"tarefas_notificadas": tarefas_notificadas, "subscriptions_removidas": removidas}


def _enviar_push(subscription, tarefa):
    payload = json.dumps({"title": "LagoAgro", "body": f"Tarefa de hoje: {tarefa.descricao}"})
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL},
            timeout=10,
        )
        return True, False
    except WebPushException as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        expirada = status_code in (404, 410)
        logger.warning(
            "Falha ao enviar push para subscription %s (tarefa %s): status=%s",
            subscription.id, tarefa.id, status_code,
        )
        return False, expirada
    except Exception as exc:
        logger.warning(
            "Erro inesperado ao enviar push para subscription %s (tarefa %s): %s",
            subscription.id, tarefa.id, exc,
        )
        return False, False
