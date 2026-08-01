from io import StringIO
from unittest.mock import patch

from django.core.management import call_command


def test_comando_chama_servico_e_imprime_resumo():
    saida = StringIO()

    with patch(
        "notifications.management.commands.enviar_notificacoes_do_dia.enviar_notificacoes_do_dia"
    ) as mock_enviar:
        mock_enviar.return_value = {"tarefas_notificadas": 3, "subscriptions_removidas": 1}
        call_command("enviar_notificacoes_do_dia", stdout=saida)

    mock_enviar.assert_called_once()
    assert "3" in saida.getvalue()
    assert "1" in saida.getvalue()
