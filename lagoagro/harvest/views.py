from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Colheita
from .serializers import ColheitaSerializer


class ColheitaViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Colheita.objects.all()
    serializer_class = ColheitaSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"
