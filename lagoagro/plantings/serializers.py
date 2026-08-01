from rest_framework import serializers

from properties.models import Talhao

from .models import Plantio


class PlantioSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["talhao"].queryset = Talhao.objects.filter(propriedade__usuario=request.user)

    class Meta:
        model = Plantio
        fields = ["id", "talhao", "cultura", "data_plantio", "status"]
