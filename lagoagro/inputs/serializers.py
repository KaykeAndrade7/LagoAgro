from rest_framework import serializers

from plantings.models import Plantio

from .models import AplicacaoInsumo, Insumo


class InsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insumo
        fields = ["id", "nome", "tipo", "carencia_dias"]


class AplicacaoInsumoSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)
            self.fields["insumo"].queryset = Insumo.objects.filter(usuario=request.user)

    class Meta:
        model = AplicacaoInsumo
        fields = ["id", "plantio", "insumo", "data", "quantidade"]
