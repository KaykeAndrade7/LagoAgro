from rest_framework import serializers

from .models import PushSubscription


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ["id", "endpoint", "p256dh", "auth", "criado_em"]
        read_only_fields = ["criado_em"]
        # `endpoint` e' unique=True no model, entao o ModelSerializer geraria
        # automaticamente um UniqueValidator nesse campo - o que rejeitaria
        # com 400 qualquer reenvio do mesmo endpoint antes mesmo de chegar
        # em `perform_create`. Como a view trata reenvio do mesmo endpoint
        # como update-or-create (nao como erro), esse validator automatico
        # precisa ser desligado aqui.
        extra_kwargs = {"endpoint": {"validators": []}}
