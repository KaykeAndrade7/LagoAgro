from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import UsuarioScopedQuerySetMixin
from domain.safety_calc import data_segura_colheita
from inputs.models import AplicacaoInsumo

from .models import Plantio
from .serializers import PlantioSerializer


class PlantioViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Plantio.objects.all()
    serializer_class = PlantioSerializer
    usuario_lookup = "talhao__propriedade__usuario"

    @action(detail=True, methods=["get"], url_path="data-segura-colheita")
    def data_segura_colheita_view(self, request, pk=None):
        plantio = self.get_object()
        aplicacoes = [
            {"data": a.data, "carencia_dias": a.insumo.carencia_dias}
            for a in AplicacaoInsumo.objects.filter(plantio=plantio).select_related("insumo")
        ]
        data_segura = data_segura_colheita(aplicacoes)
        return Response({"data_segura": data_segura.isoformat() if data_segura else None})
