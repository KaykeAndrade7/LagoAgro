from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import UsuarioScopedQuerySetMixin

from .models import Diaria, LancamentoFinanceiro, Trabalhador
from .serializers import DiariaSerializer, LancamentoFinanceiroSerializer, TrabalhadorSerializer
from .services import pagar_diarias_pendentes


class LancamentoFinanceiroViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = LancamentoFinanceiro.objects.all()
    serializer_class = LancamentoFinanceiroSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"


class TrabalhadorViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Trabalhador.objects.all()
    serializer_class = TrabalhadorSerializer
    usuario_lookup = "usuario"

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=["post"], url_path="pagar-diarias")
    def pagar_diarias(self, request, pk=None):
        trabalhador = self.get_object()
        lancamentos = pagar_diarias_pendentes(trabalhador)
        serializer = LancamentoFinanceiroSerializer(lancamentos, many=True)
        return Response(serializer.data)


class DiariaViewSet(UsuarioScopedQuerySetMixin, viewsets.ModelViewSet):
    queryset = Diaria.objects.all()
    serializer_class = DiariaSerializer
    usuario_lookup = "plantio__talhao__propriedade__usuario"
