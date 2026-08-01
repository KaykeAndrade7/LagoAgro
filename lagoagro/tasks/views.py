from rest_framework import viewsets

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Tarefa
from .serializers import TarefaSerializer


class TarefaViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Tarefa.objects.all()
    serializer_class = TarefaSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"
