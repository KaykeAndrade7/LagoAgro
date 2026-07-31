from rest_framework import serializers

from .models import Propriedade, Talhao


class PropriedadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Propriedade
        fields = ["id", "nome"]


class TalhaoSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["propriedade"].queryset = Propriedade.objects.filter(usuario=request.user)

    class Meta:
        model = Talhao
        fields = ["id", "propriedade", "nome", "area", "tipo_solo"]
