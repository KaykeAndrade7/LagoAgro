import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from crops.models import Cultura, FaseCultura

pytestmark = pytest.mark.django_db


def test_cultura_pode_ser_embutida_ou_de_uma_conta():
    # usuario nulo = catalogo embutido (pimentao, tomate, batata no MVP,
    # ver seed_culturas); usuario preenchido = variedade cadastrada pela
    # propria conta (ADR: ver spec 2026-08-06-cultura-cadastro-por-conta).
    embutida = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    usuario = get_user_model().objects.create_user(username="produtor1", password="senha123")
    propria = Cultura.objects.create(usuario=usuario, nome="Tomate Cereja", ciclo_dias=70)

    assert embutida.usuario is None
    assert propria.usuario == usuario
    assert str(embutida) == "Pimentao"


def test_duas_contas_podem_ter_cultura_propria_com_mesmo_nome():
    User = get_user_model()
    usuario1 = User.objects.create_user(username="produtor1", password="senha123")
    usuario2 = User.objects.create_user(username="produtor2", password="senha123")

    Cultura.objects.create(usuario=usuario1, nome="Tomate Cereja", ciclo_dias=70)
    Cultura.objects.create(usuario=usuario2, nome="Tomate Cereja", ciclo_dias=65)

    assert Cultura.objects.filter(nome="Tomate Cereja").count() == 2


def test_mesma_conta_nao_pode_repetir_nome_de_cultura():
    usuario = get_user_model().objects.create_user(username="produtor1", password="senha123")
    Cultura.objects.create(usuario=usuario, nome="Tomate Cereja", ciclo_dias=70)

    with pytest.raises(IntegrityError):
        Cultura.objects.create(usuario=usuario, nome="Tomate Cereja", ciclo_dias=65)


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
