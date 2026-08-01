from rest_framework.test import APIClient

from crops.models import Cultura, FaseCultura


def test_listar_culturas_inclui_fases_aninhadas(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=cultura, nome="Plantio", dia_inicio=0, dia_fim=10)
    FaseCultura.objects.create(cultura=cultura, nome="Floracao", dia_inicio=11, dia_fim=40)

    response = client.get("/api/culturas/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert len(response.data[0]["fases"]) == 2
    assert response.data[0]["fases"][0]["nome"] == "Plantio"


def test_criar_cultura_via_api_nao_e_permitido(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()

    response = client.post("/api/culturas/", {"nome": "Milho", "ciclo_dias": 100})

    assert response.status_code == 405


def test_listar_culturas_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/culturas/")

    assert response.status_code == 401
