from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APIClient


@override_settings(NOTIFICATION_TRIGGER_SECRET="segredo-teste")
def test_secret_valido_dispara_e_retorna_200():
    client = APIClient()

    with patch("notifications.views.enviar_notificacoes_do_dia") as mock_enviar:
        mock_enviar.return_value = {"tarefas_notificadas": 2, "subscriptions_removidas": 0}
        response = client.post("/api/notificacoes/disparar/", HTTP_X_NOTIFICATION_SECRET="segredo-teste")

    assert response.status_code == 200
    assert response.data == {"tarefas_notificadas": 2, "subscriptions_removidas": 0}
    mock_enviar.assert_called_once()


@override_settings(NOTIFICATION_TRIGGER_SECRET="segredo-teste")
def test_sem_header_retorna_403():
    client = APIClient()

    response = client.post("/api/notificacoes/disparar/")

    assert response.status_code == 403


@override_settings(NOTIFICATION_TRIGGER_SECRET="segredo-teste")
def test_secret_errado_retorna_403():
    client = APIClient()

    response = client.post("/api/notificacoes/disparar/", HTTP_X_NOTIFICATION_SECRET="errado")

    assert response.status_code == 403


@override_settings(NOTIFICATION_TRIGGER_SECRET="")
def test_secret_nao_configurado_falha_fechado():
    client = APIClient()

    response = client.post("/api/notificacoes/disparar/", HTTP_X_NOTIFICATION_SECRET="qualquer-coisa")

    assert response.status_code == 403
