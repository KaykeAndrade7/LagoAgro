from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from crops.models import Cultura
from finance.models import LancamentoFinanceiro
from harvest.models import Colheita
from plantings.models import Plantio
from properties.models import Propriedade, Talhao
from tasks.models import Tarefa

pytestmark = pytest.mark.django_db


def _criar_plantio():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_tarefa_pertence_a_um_plantio_e_comeca_nao_concluida():
    plantio = _criar_plantio()

    tarefa = Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data="2026-02-01")

    assert tarefa.plantio == plantio
    assert tarefa.concluida is False


def test_colheita_registra_classificacao_e_quantidade():
    plantio = _criar_plantio()

    # Decimal direto na criacao (nao string) - ver nota em test_properties_models.py
    # sobre por que comparar contra int/float exigiria refresh_from_db().
    colheita = Colheita.objects.create(
        plantio=plantio, data="2026-04-01", classificacao="primeira", quantidade=Decimal("50.00")
    )

    assert colheita.classificacao == "primeira"
    assert colheita.quantidade == Decimal("50.00")


def test_lancamento_financeiro_pertence_a_um_plantio():
    plantio = _criar_plantio()

    lancamento = LancamentoFinanceiro.objects.create(
        plantio=plantio, valor=Decimal("150.00"), data="2026-01-15", descricao="Compra de mudas"
    )

    assert lancamento.plantio == plantio
    assert lancamento.valor == Decimal("150.00")


def test_deletar_plantio_deleta_tarefas_colheitas_e_lancamentos_em_cascata():
    plantio = _criar_plantio()
    Tarefa.objects.create(plantio=plantio, descricao="Aplicar defensivo", data="2026-02-01")
    Colheita.objects.create(plantio=plantio, data="2026-04-01", classificacao="primeira", quantidade="50.00")
    LancamentoFinanceiro.objects.create(plantio=plantio, valor="150.00", data="2026-01-15", descricao="Compra de mudas")

    plantio.delete()

    assert Tarefa.objects.count() == 0
    assert Colheita.objects.count() == 0
    assert LancamentoFinanceiro.objects.count() == 0
