from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from .models import Cultura
from .serializers import CulturaSerializer


class CulturaViewSet(viewsets.ModelViewSet):
    queryset = Cultura.objects.all()
    serializer_class = CulturaSerializer

    def get_queryset(self):
        # Uniao: catalogo embutido (usuario nulo) + culturas da propria
        # conta. Nunca vaza cultura de outra conta.
        return Cultura.objects.filter(Q(usuario__isnull=True) | Q(usuario=self.request.user)).order_by("nome")

    def get_object(self):
        obj = super().get_object()
        if self.action in ("update", "partial_update", "destroy") and obj.usuario_id is None:
            raise PermissionDenied("Não é possível editar ou excluir uma cultura do catálogo padrão.")
        return obj

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
