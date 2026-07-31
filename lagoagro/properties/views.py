from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Propriedade, Talhao
from .serializers import PropriedadeSerializer, TalhaoSerializer


class PropriedadeViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Propriedade.objects.all()
    serializer_class = PropriedadeSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class TalhaoViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Talhao.objects.all()
    serializer_class = TalhaoSerializer
    usuario_lookup = "propriedade__usuario"
