from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from harvest.models import Colheita
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura, _ = Cultura.objects.get_or_create(nome="Pimentao", defaults={"ciclo_dias": 90})
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_criar_colheita_com_plantio_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/colheitas/", {
        "plantio": plantio.id, "data": "2026-04-01", "classificacao": "primeira", "quantidade": "50.00",
    })

    assert response.status_code == 201


def test_criar_colheita_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)

    response = client.post("/api/colheitas/", {
        "plantio": plantio_outro.id, "data": "2026-04-01", "classificacao": "primeira", "quantidade": "50.00",
    })

    assert response.status_code == 400


def test_listar_colheitas_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    Colheita.objects.create(plantio=plantio, data="2026-04-01", classificacao="primeira", quantidade="50.00")
    Colheita.objects.create(plantio=plantio_outro, data="2026-04-01", classificacao="primeira", quantidade="30.00")

    response = client.get("/api/colheitas/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_colheita_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    colheita_outro = Colheita.objects.create(plantio=plantio_outro, data="2026-04-01", classificacao="primeira", quantidade="30.00")

    response = client.get(f"/api/colheitas/{colheita_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/colheitas/")

    assert response.status_code == 401
