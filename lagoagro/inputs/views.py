from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import AplicacaoInsumo, Insumo
from .serializers import AplicacaoInsumoSerializer, InsumoSerializer


class InsumoViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Insumo.objects.all()
    serializer_class = InsumoSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class AplicacaoInsumoViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = AplicacaoInsumo.objects.all()
    serializer_class = AplicacaoInsumoSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
