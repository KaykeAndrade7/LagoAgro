from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from finance.models import Diaria, LancamentoFinanceiro, Trabalhador
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura, _ = Cultura.objects.get_or_create(nome="Pimentao", defaults={"ciclo_dias": 90})
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


# --- LancamentoFinanceiro ---

def test_criar_lancamento_com_plantio_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio.id, "valor": "150.00", "data": "2026-01-15", "descricao": "Compra de mudas", "setor": "insumos",
    })

    assert response.status_code == 201


def test_criar_lancamento_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)

    response = client.post("/api/lancamentos-financeiros/", {
        "plantio": plantio_outro.id, "valor": "150.00", "data": "2026-01-15", "descricao": "Compra de mudas", "setor": "insumos",
    })

    assert response.status_code == 400


def test_listar_lancamentos_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    LancamentoFinanceiro.objects.create(plantio=plantio, valor="150.00", data="2026-01-15", descricao="Meu gasto", setor="insumos")
    LancamentoFinanceiro.objects.create(plantio=plantio_outro, valor="100.00", data="2026-01-15", descricao="Gasto de outro", setor="insumos")

    response = client.get("/api/lancamentos-financeiros/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_lancamento_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    lancamento_outro = LancamentoFinanceiro.objects.create(plantio=plantio_outro, valor="100.00", data="2026-01-15", descricao="Gasto de outro", setor="insumos")

    response = client.get(f"/api/lancamentos-financeiros/{lancamento_outro.id}/")

    assert response.status_code == 404


# --- Trabalhador ---

def test_criar_trabalhador_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/trabalhadores/", {"nome": "Joao", "valor_diaria": "120.00"})

    assert response.status_code == 201
    assert Trabalhador.objects.get(id=response.data["id"]).usuario == usuario


def test_listar_trabalhadores_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))
    Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    response = client.get("/api/trabalhadores/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_trabalhador_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))

    response = client.get(f"/api/trabalhadores/{trabalhador_outro.id}/")

    assert response.status_code == 404


# --- Diaria ---

def test_criar_diaria_com_trabalhador_e_plantio_proprios_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    response = client.post("/api/diarias/", {
        "trabalhador": trabalhador.id, "plantio": plantio.id, "data": "2026-02-01",
    })

    assert response.status_code == 201
    assert response.data["valor"] == "120.00"


def test_criar_diaria_com_trabalhador_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))

    response = client.post("/api/diarias/", {
        "trabalhador": trabalhador_outro.id, "plantio": plantio.id, "data": "2026-02-01",
    })

    assert response.status_code == 400


def test_criar_diaria_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))

    response = client.post("/api/diarias/", {
        "trabalhador": trabalhador.id, "plantio": plantio_outro.id, "data": "2026-02-01",
    })

    assert response.status_code == 400


def test_listar_diarias_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")
    Diaria.objects.create(trabalhador=trabalhador_outro, plantio=plantio_outro, data="2026-02-01")

    response = client.get("/api/diarias/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_diaria_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))
    diaria_outro = Diaria.objects.create(trabalhador=trabalhador_outro, plantio=plantio_outro, data="2026-02-01")

    response = client.get(f"/api/diarias/{diaria_outro.id}/")

    assert response.status_code == 404


# --- pagar-diarias action ---

def test_pagar_diarias_pendentes_via_action_cria_lancamento(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    trabalhador = Trabalhador.objects.create(usuario=usuario, nome="Joao", valor_diaria=Decimal("120.00"))
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-01")
    Diaria.objects.create(trabalhador=trabalhador, plantio=plantio, data="2026-02-02")

    response = client.post(f"/api/trabalhadores/{trabalhador.id}/pagar-diarias/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["valor"] == "240.00"
    assert LancamentoFinanceiro.objects.count() == 1


def test_pagar_diarias_de_trabalhador_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    trabalhador_outro = Trabalhador.objects.create(usuario=outro, nome="Pedro", valor_diaria=Decimal("100.00"))

    response = client.post(f"/api/trabalhadores/{trabalhador_outro.id}/pagar-diarias/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/lancamentos-financeiros/")

    assert response.status_code == 401
