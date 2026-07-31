from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from crops.models import Cultura, FaseCultura
from domain.cycle_calc import fase_atual
from domain.safety_calc import data_segura_colheita
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def test_fase_atual_recebe_fasecultura_reais_do_banco():
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=cultura, nome="muda", dia_inicio=0, dia_fim=20)
    FaseCultura.objects.create(cultura=cultura, nome="floracao", dia_inicio=21, dia_fim=45)

    fases = list(cultura.fases.values("nome", "dia_inicio", "dia_fim"))

    resultado = fase_atual(data_plantio=date(2026, 1, 1), fases=fases, hoje=date(2026, 1, 30))

    assert resultado == "floracao"


def test_data_segura_colheita_recebe_aplicacoes_reais_do_banco():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data=date(2026, 2, 1), quantidade=Decimal("1.50"), created_by=usuario
    )

    aplicacoes = [
        {"data": a.data, "carencia_dias": a.insumo.carencia_dias} for a in plantio.aplicacoes.select_related("insumo")
    ]

    resultado = data_segura_colheita(aplicacoes)

    assert resultado == date(2026, 2, 8)
