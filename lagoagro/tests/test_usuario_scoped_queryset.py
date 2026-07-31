# lagoagro/tests/test_usuario_scoped_queryset.py
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.test import APIRequestFactory, force_authenticate

from core.permissions import UsuarioScopedQuerySetMixin
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


class _TalhaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Talhao
        fields = ["id", "nome"]


@pytest.fixture
def talhao_test_viewset():
    class _TalhaoTestViewSet(UsuarioScopedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
        queryset = Talhao.objects.all()
        serializer_class = _TalhaoSerializer
        permission_classes = [IsAuthenticated]
        usuario_lookup = "propriedade__usuario"

    return _TalhaoTestViewSet


def _criar_usuarios_e_talhoes():
    User = get_user_model()
    usuario_a = User.objects.create_user(username="produtor_a", password="senha123")
    usuario_b = User.objects.create_user(username="produtor_b", password="senha123")
    propriedade_a = Propriedade.objects.create(usuario=usuario_a, nome="Sitio A")
    propriedade_b = Propriedade.objects.create(usuario=usuario_b, nome="Sitio B")
    talhao_a1 = Talhao.objects.create(propriedade=propriedade_a, nome="Talhao A1", area=Decimal("1.00"), tipo_solo="argiloso")
    Talhao.objects.create(propriedade=propriedade_a, nome="Talhao A2", area=Decimal("2.00"), tipo_solo="arenoso")
    talhao_b1 = Talhao.objects.create(propriedade=propriedade_b, nome="Talhao B1", area=Decimal("3.00"), tipo_solo="argiloso")
    return usuario_a, usuario_b, talhao_a1, talhao_b1


def test_listagem_so_retorna_talhoes_do_usuario_autenticado(talhao_test_viewset):
    usuario_a, _, _, _ = _criar_usuarios_e_talhoes()

    factory = APIRequestFactory()
    request = factory.get("/fake-url/")
    force_authenticate(request, user=usuario_a)
    view = talhao_test_viewset.as_view({"get": "list"})
    response = view(request)

    assert response.status_code == 200
    assert {t["nome"] for t in response.data} == {"Talhao A1", "Talhao A2"}


def test_usuario_pedindo_talhao_de_outro_usuario_recebe_404(talhao_test_viewset):
    _, usuario_b, talhao_a1, _ = _criar_usuarios_e_talhoes()

    factory = APIRequestFactory()
    request = factory.get(f"/fake-url/{talhao_a1.id}/")
    force_authenticate(request, user=usuario_b)
    view = talhao_test_viewset.as_view({"get": "retrieve"})
    response = view(request, pk=talhao_a1.id)

    assert response.status_code == 404
