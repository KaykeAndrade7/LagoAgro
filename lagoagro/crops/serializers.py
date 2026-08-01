from rest_framework import serializers

from .models import Cultura, FaseCultura


class FaseCulturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaseCultura
        fields = ["id", "nome", "dia_inicio", "dia_fim"]


class CulturaSerializer(serializers.ModelSerializer):
    fases = FaseCulturaSerializer(many=True, read_only=True)

    class Meta:
        model = Cultura
        fields = ["id", "nome", "ciclo_dias", "fases"]
