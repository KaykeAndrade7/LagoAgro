from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from pywebpush import WebPushException

from crops.models import Cultura
from notifications.models import PushSubscription
from notifications.services import enviar_notificacoes_do_dia
from plantings.models import Plantio
from properties.models import Propriedade, Talhao
from tasks.models import Tarefa

pytestmark = pytest.mark.django_db


class _FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


def _criar_plantio_e_usuario(username="produtor1"):
    usuario = get_user_model().objects.create_user(username=username, password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura, _ = Cultura.objects.get_or_create(nome="Pimentao", defaults={"ciclo_dias": 90})
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    return usuario, plantio


def test_envia_push_para_tarefa_de_hoje_nao_concluida():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 1
    assert resultado == {"tarefas_notificadas": 1, "subscriptions_removidas": 0}


def test_pula_tarefa_concluida():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje, concluida=True)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 0
    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 0}


def test_pula_tarefa_de_outro_dia():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje + timedelta(days=1))

    with patch("notifications.services.webpush") as mock_webpush:
        enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 0


def test_envia_para_todas_as_subscriptions_do_usuario():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/2", p256dh="c", auth="d")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 2
    assert resultado["tarefas_notificadas"] == 1


def test_subscription_expirada_e_removida_em_410():
    usuario, plantio = _criar_plantio_e_usuario()
    subscription = PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush", side_effect=WebPushException("gone", response=_FakeResponse(410))):
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 1}
    assert not PushSubscription.objects.filter(id=subscription.id).exists()


def test_erro_temporario_mantem_subscription():
    usuario, plantio = _criar_plantio_e_usuario()
    subscription = PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    tarefa = Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush", side_effect=WebPushException("erro temporario", response=_FakeResponse(500))):
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 0}
    assert PushSubscription.objects.filter(id=subscription.id).exists()
    tarefa.refresh_from_db()
    assert tarefa.notificado_em is None, (
        "tarefa nao deve ser marcada como notificada quando todos os envios falham "
        "de forma transitoria, para permitir retry no mesmo dia"
    )


def test_erro_temporario_permite_retry_no_mesmo_dia():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch(
        "notifications.services.webpush",
        side_effect=[WebPushException("erro temporario", response=_FakeResponse(500)), None],
    ) as mock_webpush:
        primeiro_resultado = enviar_notificacoes_do_dia(hoje=hoje)
        segundo_resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 2
    assert primeiro_resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 0}
    assert segundo_resultado == {"tarefas_notificadas": 1, "subscriptions_removidas": 0}


def test_excecao_nao_prevista_e_tratada_como_falha_transitoria():
    usuario, plantio = _criar_plantio_e_usuario()
    subscription = PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    tarefa = Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush", side_effect=ConnectionError("timeout de rede")):
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 0}
    assert PushSubscription.objects.filter(id=subscription.id).exists()
    tarefa.refresh_from_db()
    assert tarefa.notificado_em is None


def test_pelo_menos_um_sucesso_marca_tarefa_como_notificada():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/2", p256dh="c", auth="d")
    hoje = timezone.localdate()
    tarefa = Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch(
        "notifications.services.webpush",
        side_effect=[None, WebPushException("erro temporario", response=_FakeResponse(500))],
    ):
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert resultado == {"tarefas_notificadas": 1, "subscriptions_removidas": 0}
    tarefa.refresh_from_db()
    assert tarefa.notificado_em is not None


def test_tarefa_sem_subscription_e_marcada_como_notificada():
    usuario, plantio = _criar_plantio_e_usuario()
    hoje = timezone.localdate()
    tarefa = Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 0
    assert resultado == {"tarefas_notificadas": 0, "subscriptions_removidas": 0}
    tarefa.refresh_from_db()
    assert tarefa.notificado_em is not None, (
        "tarefa sem dispositivo registrado deve ser marcada como notificada "
        "para nao ficar pendente para sempre"
    )


def test_cada_usuario_recebe_push_apenas_das_proprias_subscriptions():
    usuario1, plantio1 = _criar_plantio_e_usuario("produtor1")
    usuario2, plantio2 = _criar_plantio_e_usuario("produtor2")
    subscription1 = PushSubscription.objects.create(
        usuario=usuario1, endpoint="https://push.example/produtor1", p256dh="a", auth="b"
    )
    subscription2 = PushSubscription.objects.create(
        usuario=usuario2, endpoint="https://push.example/produtor2", p256dh="c", auth="d"
    )
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio1, descricao="Tarefa do produtor1", data=hoje)
    Tarefa.objects.create(plantio=plantio2, descricao="Tarefa do produtor2", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        resultado = enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 2
    assert resultado["tarefas_notificadas"] == 2

    endpoints_chamados = {
        call.kwargs["subscription_info"]["endpoint"] for call in mock_webpush.call_args_list
    }
    assert endpoints_chamados == {subscription1.endpoint, subscription2.endpoint}


def test_rodar_duas_vezes_no_mesmo_dia_nao_duplica_envio():
    usuario, plantio = _criar_plantio_e_usuario()
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    hoje = timezone.localdate()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data=hoje)

    with patch("notifications.services.webpush") as mock_webpush:
        enviar_notificacoes_do_dia(hoje=hoje)
        enviar_notificacoes_do_dia(hoje=hoje)

    assert mock_webpush.call_count == 1
