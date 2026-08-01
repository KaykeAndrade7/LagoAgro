import secrets

from django.conf import settings
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import UsuarioScopedQuerySetMixin

from .models import PushSubscription
from .serializers import PushSubscriptionSerializer
from .services import enviar_notificacoes_do_dia


class PushSubscriptionViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = PushSubscription.objects.all()
    serializer_class = PushSubscriptionSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        # Desvio deliberado do padrao `serializer.save(usuario=...)` usado
        # nos outros apps: o endpoint e globalmente unico, entao registrar
        # de novo o mesmo endpoint (navegador reemitindo a subscription, ou
        # outra conta no mesmo aparelho) precisa atualizar a linha existente
        # em vez de violar a constraint ou duplicar. `serializer.instance` e
        # setado manualmente pra `serializer.data` (usado pela resposta 201)
        # renderizar o objeto real, com `id` e `criado_em` incluidos.
        subscription, _ = PushSubscription.objects.update_or_create(
            endpoint=serializer.validated_data["endpoint"],
            defaults={
                "usuario": self.request.user,
                "p256dh": serializer.validated_data["p256dh"],
                "auth": serializer.validated_data["auth"],
            },
        )
        serializer.instance = subscription


class DispararNotificacoesView(APIView):
    """Endpoint chamado pelo cron externo (ADR 006) - sem JWT, protegido por
    chave secreta no header (threat-model.md: comparacao com
    secrets.compare_digest, nunca em query string, falha fechado se a chave
    nao estiver configurada)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        secret_recebido = request.headers.get("X-Notification-Secret", "")
        secret_esperado = settings.NOTIFICATION_TRIGGER_SECRET
        if not secret_esperado or not secrets.compare_digest(secret_recebido, secret_esperado):
            return Response({"detail": "Não autorizado."}, status=403)

        resultado = enviar_notificacoes_do_dia()
        return Response(resultado)
