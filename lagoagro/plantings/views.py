from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Plantio
from .serializers import PlantioSerializer


class PlantioViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Plantio.objects.all()
    serializer_class = PlantioSerializer
    usuario_lookup = "talhao__propriedade__usuario"
