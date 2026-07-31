from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError

from crops.models import Cultura
from finance.models import Trabalhador
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def _criar_plantio_e_usuario():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    return usuario, plantio


def test_trabalhador_pertence_a_um_usuario_e_comeca_ativo():
    usuario, _ = _criar_plantio_e_usuario()

    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    assert trabalhador.usuario == usuario
    assert trabalhador.valor_diaria == Decimal("120.00")
    assert trabalhador.ativo is True
