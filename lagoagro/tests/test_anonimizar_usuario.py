from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from crops.models import Cultura
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def test_anonimizar_usuario_remove_dados_pessoais_mas_mantem_a_conta():
    User = get_user_model()
    usuario = User.objects.create_user(
        username="produtor1", email="produtor1@example.com", password="senha123",
        first_name="Joao", last_name="Silva",
    )

    call_command("anonimizar_usuario", usuario.pk)

    usuario.refresh_from_db()
    assert usuario.username == f"usuario-excluido-{usuario.pk}"
    assert usuario.email == ""
    assert usuario.first_name == ""
    assert usuario.last_name == ""
    assert usuario.is_active is False
    assert not usuario.has_usable_password()


def test_anonimizar_usuario_preserva_historico_operacional():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    aplicacao = AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade=Decimal("1.50"), created_by=usuario
    )

    call_command("anonimizar_usuario", usuario.pk)

    aplicacao.refresh_from_db()
    assert aplicacao.plantio_id == plantio.pk
    assert Talhao.objects.filter(pk=talhao.pk).exists()
    assert Insumo.objects.filter(pk=insumo.pk).exists()
