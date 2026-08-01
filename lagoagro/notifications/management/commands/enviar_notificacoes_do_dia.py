from django.core.management.base import BaseCommand

from notifications.services import enviar_notificacoes_do_dia


class Command(BaseCommand):
    help = "Envia push notification para tarefas que vencem hoje (ADR 006)."

    def handle(self, *args, **options):
        resultado = enviar_notificacoes_do_dia()
        self.stdout.write(self.style.SUCCESS(
            f"{resultado['tarefas_notificadas']} notificacoes enviadas, "
            f"{resultado['subscriptions_removidas']} subscriptions expiradas removidas."
        ))
