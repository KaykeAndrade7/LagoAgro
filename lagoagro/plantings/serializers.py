from django.db.models import Q
from rest_framework import serializers

from crops.models import Cultura
from properties.models import Talhao

from .models import Plantio


class PlantioSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["talhao"].queryset = Talhao.objects.filter(propriedade__usuario=request.user)
            self.fields["cultura"].queryset = Cultura.objects.filter(
                Q(usuario__isnull=True) | Q(usuario=request.user)
            )

    class Meta:
        model = Plantio
        fields = ["id", "talhao", "cultura", "data_plantio", "status"]
