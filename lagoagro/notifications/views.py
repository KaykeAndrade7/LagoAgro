from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import PushSubscription
from .serializers import PushSubscriptionSerializer


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
