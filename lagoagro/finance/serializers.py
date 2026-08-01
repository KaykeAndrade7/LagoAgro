from rest_framework import serializers

from plantings.models import Plantio

from .models import Diaria, LancamentoFinanceiro, Trabalhador


class LancamentoFinanceiroSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = LancamentoFinanceiro
        fields = ["id", "plantio", "valor", "data", "descricao", "setor"]


class TrabalhadorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trabalhador
        fields = ["id", "nome", "valor_diaria", "ativo"]


class DiariaSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["trabalhador"].queryset = Trabalhador.objects.filter(usuario=request.user)
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = Diaria
        fields = ["id", "trabalhador", "plantio", "data", "valor", "lancamento"]
        read_only_fields = ["valor", "lancamento"]
