from django.db.models import Q
from rest_framework import serializers

from .models import Cultura, FaseCultura


class FaseCulturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaseCultura
        fields = ["id", "nome", "dia_inicio", "dia_fim"]
        read_only_fields = ["id"]


class CulturaSerializer(serializers.ModelSerializer):
    fases = FaseCulturaSerializer(many=True)
    somente_leitura = serializers.SerializerMethodField()

    class Meta:
        model = Cultura
        fields = ["id", "nome", "ciclo_dias", "fases", "somente_leitura"]

    def get_somente_leitura(self, obj):
        return obj.usuario_id is None

    def validate_fases(self, fases):
        if not fases:
            raise serializers.ValidationError("Cadastre pelo menos uma fase.")
        for fase in fases:
            if fase["dia_inicio"] >= fase["dia_fim"]:
                raise serializers.ValidationError("Em cada fase, dia_inicio deve ser menor que dia_fim.")
        return fases

    def validate_nome(self, nome):
        # Nome nao pode colidir (sem diferenciar maiuscula/minuscula) com
        # nenhuma cultura visivel a esta conta - embutida ou propria -
        # senao o dropdown de plantio fica com duas entradas confusas com
        # o mesmo nome.
        request = self.context["request"]
        queryset = Cultura.objects.filter(Q(usuario__isnull=True) | Q(usuario=request.user)).filter(
            nome__iexact=nome
        )
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Já existe uma cultura com esse nome.")
        return nome

    def create(self, validated_data):
        fases_data = validated_data.pop("fases")
        cultura = Cultura.objects.create(**validated_data)
        FaseCultura.objects.bulk_create([FaseCultura(cultura=cultura, **fase) for fase in fases_data])
        return cultura

    def update(self, instance, validated_data):
        # Substituicao completa da lista de fases (nao merge item a item) -
        # mais simples e evita fase "orfa" quando o cliente reordena/remove.
        fases_data = validated_data.pop("fases", None)
        instance.nome = validated_data.get("nome", instance.nome)
        instance.ciclo_dias = validated_data.get("ciclo_dias", instance.ciclo_dias)
        instance.save()
        if fases_data is not None:
            instance.fases.all().delete()
            FaseCultura.objects.bulk_create([FaseCultura(cultura=instance, **fase) for fase in fases_data])
        return instance
