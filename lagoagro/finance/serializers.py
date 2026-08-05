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
        fields = ["id", "plantio", "tipo", "valor", "data", "descricao", "setor"]
        extra_kwargs = {"tipo": {"required": True}}

    def validate(self, attrs):
        # PATCH parcial pode nao mandar tipo/setor - cai no valor atual da
        # instancia. Create sempre manda os dois (tipo e obrigatorio, setor
        # ja era obrigatorio antes desta mudanca).
        if self.instance is not None:
            tipo = attrs.get("tipo", self.instance.tipo)
            setor = attrs.get("setor", self.instance.setor)
        else:
            tipo = attrs.get("tipo")
            setor = attrs.get("setor")

        setores_validos = LancamentoFinanceiro.GANHO_SETORES if tipo == "ganho" else LancamentoFinanceiro.GASTO_SETORES
        if setor is not None and setor not in setores_validos:
            raise serializers.ValidationError(f"Setor '{setor}' não é válido para o tipo '{tipo}'.")
        return attrs


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

    def validate(self, attrs):
        # Uma diaria ja paga (lancamento setado via acao pagar-diarias) e
        # trilha de pagamento fechada - alterar trabalhador/plantio/data
        # deixaria o valor do LancamentoFinanceiro ja gerado incoerente.
        if self.instance is not None and self.instance.lancamento_id is not None:
            raise serializers.ValidationError(
                "Não é possível alterar uma diária já paga."
            )
        return attrs
