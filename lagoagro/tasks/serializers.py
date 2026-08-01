from rest_framework import serializers

from plantings.models import Plantio

from .models import Tarefa


class TarefaSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["plantio"].queryset = Plantio.objects.filter(talhao__propriedade__usuario=request.user)

    class Meta:
        model = Tarefa
        fields = ["id", "plantio", "descricao", "data", "concluida"]
