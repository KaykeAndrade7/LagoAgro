import pytest

from crops.models import Cultura, FaseCultura

pytestmark = pytest.mark.django_db


def test_cultura_e_catalogo_compartilhado_sem_usuario():
    # Cultura nao tem usuario_id: e catalogo de referencia (pimentao, tomate,
    # batata no MVP), nao dado pertencente a um usuario - excecao deliberada
    # ao ADR 002, que exige usuario_id em dado de dominio do usuario.
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    assert not hasattr(cultura, "usuario")
    assert str(cultura) == "Pimentao"


def test_fase_cultura_pertence_a_uma_cultura_com_intervalo_de_dias():
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    fase = FaseCultura.objects.create(cultura=cultura, nome="muda", dia_inicio=0, dia_fim=20)

    assert fase.cultura == cultura
    assert fase.dia_inicio == 0
    assert fase.dia_fim == 20


def test_fases_sao_ordenadas_por_dia_inicio():
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=cultura, nome="floracao", dia_inicio=21, dia_fim=45)
    FaseCultura.objects.create(cultura=cultura, nome="muda", dia_inicio=0, dia_fim=20)

    nomes = list(cultura.fases.values_list("nome", flat=True))

    assert nomes == ["muda", "floracao"]
