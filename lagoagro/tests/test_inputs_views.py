from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura, _ = Cultura.objects.get_or_create(nome="Pimentao", defaults={"ciclo_dias": 90})
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_criar_insumo_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/insumos/", {"nome": "ProdutoX", "tipo": "veneno", "carencia_dias": 7})

    assert response.status_code == 201
    assert Insumo.objects.get(id=response.data["id"]).usuario == usuario


def test_listar_insumos_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    Insumo.objects.create(usuario=outro, nome="ProdutoY", tipo="adubo", carencia_dias=0)
    Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    response = client.get("/api/insumos/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_criar_aplicacao_com_plantio_e_insumo_proprios_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    response = client.post("/api/aplicacoes-insumo/", {
        "plantio": plantio.id, "insumo": insumo.id, "data": "2026-02-01", "quantidade": "1.50",
    })

    assert response.status_code == 201
    assert AplicacaoInsumo.objects.get(id=response.data["id"]).created_by == usuario


def test_criar_aplicacao_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    response = client.post("/api/aplicacoes-insumo/", {
        "plantio": plantio_outro.id, "insumo": insumo.id, "data": "2026-02-01", "quantidade": "1.50",
    })

    assert response.status_code == 400


def test_criar_aplicacao_com_insumo_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    insumo_outro = Insumo.objects.create(usuario=outro, nome="ProdutoY", tipo="adubo", carencia_dias=0)

    response = client.post("/api/aplicacoes-insumo/", {
        "plantio": plantio.id, "insumo": insumo_outro.id, "data": "2026-02-01", "quantidade": "1.50",
    })

    assert response.status_code == 400


def test_acessar_insumo_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    insumo_outro = Insumo.objects.create(usuario=outro, nome="ProdutoY", tipo="adubo", carencia_dias=0)

    response = client.get(f"/api/insumos/{insumo_outro.id}/")

    assert response.status_code == 404


def test_listar_aplicacoes_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    insumo_outro = Insumo.objects.create(usuario=outro, nome="ProdutoY", tipo="adubo", carencia_dias=0)
    AplicacaoInsumo.objects.create(plantio=plantio, insumo=insumo, data="2026-02-01", quantidade=Decimal("1.50"))
    AplicacaoInsumo.objects.create(plantio=plantio_outro, insumo=insumo_outro, data="2026-02-01", quantidade=Decimal("1.00"))

    response = client.get("/api/aplicacoes-insumo/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_aplicacao_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    insumo_outro = Insumo.objects.create(usuario=outro, nome="ProdutoY", tipo="adubo", carencia_dias=0)
    aplicacao_outro = AplicacaoInsumo.objects.create(
        plantio=plantio_outro, insumo=insumo_outro, data="2026-02-01", quantidade=Decimal("1.00")
    )

    response = client.get(f"/api/aplicacoes-insumo/{aplicacao_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/insumos/")

    assert response.status_code == 401


def test_requisicao_sem_token_em_aplicacoes_insumo_retorna_401():
    client = APIClient()

    response = client.get("/api/aplicacoes-insumo/")

    assert response.status_code == 401
