import secrets

from django.conf import settings
from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import UsuarioScopedQuerySetMixin

from .models import PushSubscription
from .serializers import PushSubscriptionSerializer
from .services import enviar_notificacoes_do_dia


class PushSubscriptionViewSet(
    UsuarioScopedQuerySetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    # Deliberadamente NAO um ModelViewSet: update/partial_update nunca foram
    # suportados por design (ver perform_create abaixo) e um PATCH/PUT com o
    # `endpoint` de outra subscription do mesmo usuario bateria na constraint
    # unique=True do model sem o UniqueValidator (desligado so pra create),
    # gerando IntegrityError -> 500 nao tratado. Restringir as acoes evita a
    # rota por completo (405) em vez de tratar o erro.
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
        if not secret_esperado or not secrets.compare_digest(secret_recebido.encode(), secret_esperado.encode()):
            return Response({"detail": "Não autorizado."}, status=403)

        resultado = enviar_notificacoes_do_dia()
        return Response(resultado)


class VapidPublicKeyView(APIView):
    """Expoe a metade publica do par de chaves VAPID (ADR 005) - nao e
    segredo por definicao, entao nao exige autenticacao."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"public_key": settings.VAPID_PUBLIC_KEY})
