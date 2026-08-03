from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def test_criar_plantio_com_talhao_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    response = client.post("/api/plantios/", {
        "talhao": talhao.id, "cultura": cultura.id, "data_plantio": "2026-01-01",
    })

    assert response.status_code == 201


def test_criar_plantio_com_talhao_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    response = client.post("/api/plantios/", {
        "talhao": talhao_outro.id, "cultura": cultura.id, "data_plantio": "2026-01-01",
    })

    assert response.status_code == 400


def test_listar_plantios_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    Plantio.objects.create(talhao=talhao_outro, cultura=cultura, data_plantio="2026-01-01")

    response = client.get("/api/plantios/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_plantio_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio_outro = Plantio.objects.create(talhao=talhao_outro, cultura=cultura, data_plantio="2026-01-01")

    response = client.get(f"/api/plantios/{plantio_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/plantios/")

    assert response.status_code == 401


def test_data_segura_colheita_sem_aplicacoes_retorna_null(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    response = client.get(f"/api/plantios/{plantio.id}/data-segura-colheita/")

    assert response.status_code == 200
    assert response.data["data_segura"] is None


def test_data_segura_colheita_usa_a_maior_data_entre_aplicacoes(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    inseticida = Insumo.objects.create(usuario=usuario, nome="Inseticida", tipo="veneno", carencia_dias=7)
    adubo = Insumo.objects.create(usuario=usuario, nome="Adubo", tipo="adubo", carencia_dias=1)
    AplicacaoInsumo.objects.create(plantio=plantio, insumo=inseticida, data=date(2026, 1, 10), quantidade=Decimal("1.00"))
    AplicacaoInsumo.objects.create(plantio=plantio, insumo=adubo, data=date(2026, 1, 15), quantidade=Decimal("1.00"))

    response = client.get(f"/api/plantios/{plantio.id}/data-segura-colheita/")

    assert response.status_code == 200
    assert response.data["data_segura"] == "2026-01-17"  # 2026-01-10 + 7 dias > 2026-01-15 + 1 dia


def test_data_segura_colheita_de_plantio_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    talhao_outro = Talhao.objects.create(propriedade=propriedade_outro, nome="Talhao X", area=Decimal("1.00"), tipo_solo="arenoso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio_outro = Plantio.objects.create(talhao=talhao_outro, cultura=cultura, data_plantio="2026-01-01")

    response = client.get(f"/api/plantios/{plantio_outro.id}/data-segura-colheita/")

    assert response.status_code == 404
