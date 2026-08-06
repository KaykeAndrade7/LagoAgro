from rest_framework.test import APIClient

from crops.models import Cultura, FaseCultura


def _payload_valido(nome="Tomate Cereja"):
    return {
        "nome": nome,
        "ciclo_dias": 70,
        "fases": [
            {"nome": "Muda", "dia_inicio": 0, "dia_fim": 15},
            {"nome": "Colheita", "dia_inicio": 15, "dia_fim": 70},
        ],
    }


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
    assert response.data[0]["somente_leitura"] is True


def test_listar_culturas_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/culturas/")

    assert response.status_code == 401


def test_listar_culturas_retorna_embutidas_e_so_as_proprias_da_conta(criar_usuario_autenticado):
    usuario1, client1 = criar_usuario_autenticado("produtor1")
    _, client2 = criar_usuario_autenticado("produtor2")
    Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=Cultura.objects.get(nome="Pimentao"), nome="Muda", dia_inicio=0, dia_fim=10)
    propria1 = Cultura.objects.create(usuario=usuario1, nome="Tomate Cereja", ciclo_dias=70)
    FaseCultura.objects.create(cultura=propria1, nome="Muda", dia_inicio=0, dia_fim=15)

    response1 = client1.get("/api/culturas/")
    response2 = client2.get("/api/culturas/")

    nomes1 = {c["nome"] for c in response1.data}
    nomes2 = {c["nome"] for c in response2.data}
    assert nomes1 == {"Pimentao", "Tomate Cereja"}
    assert nomes2 == {"Pimentao"}


def test_criar_cultura_com_fases_aninhadas(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/culturas/", _payload_valido(), format="json")

    assert response.status_code == 201
    assert response.data["somente_leitura"] is False
    assert len(response.data["fases"]) == 2
    cultura = Cultura.objects.get(id=response.data["id"])
    assert cultura.usuario == usuario
    assert cultura.fases.count() == 2


def test_criar_cultura_sem_fases_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    payload = _payload_valido()
    payload["fases"] = []

    response = client.post("/api/culturas/", payload, format="json")

    assert response.status_code == 400
    assert "fases" in response.data


def test_criar_cultura_com_fase_dia_inicio_maior_que_dia_fim_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    payload = _payload_valido()
    payload["fases"] = [{"nome": "Muda", "dia_inicio": 20, "dia_fim": 10}]

    response = client.post("/api/culturas/", payload, format="json")

    assert response.status_code == 400
    assert "fases" in response.data


def test_criar_cultura_com_nome_igual_a_embutida_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    Cultura.objects.create(nome="Tomate", ciclo_dias=120)

    response = client.post("/api/culturas/", _payload_valido(nome="tomate"), format="json")

    assert response.status_code == 400
    assert "nome" in response.data


def test_criar_cultura_com_nome_repetido_na_mesma_conta_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    client.post("/api/culturas/", _payload_valido(), format="json")

    response = client.post("/api/culturas/", _payload_valido(), format="json")

    assert response.status_code == 400
    assert "nome" in response.data


def test_editar_cultura_propria_substitui_a_lista_de_fases(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    criada = client.post("/api/culturas/", _payload_valido(), format="json").data

    payload = _payload_valido()
    payload["fases"] = [{"nome": "Fase unica", "dia_inicio": 0, "dia_fim": 70}]
    response = client.patch(f"/api/culturas/{criada['id']}/", payload, format="json")

    assert response.status_code == 200
    assert len(response.data["fases"]) == 1
    assert response.data["fases"][0]["nome"] == "Fase unica"


def test_editar_cultura_embutida_retorna_403(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    embutida = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    FaseCultura.objects.create(cultura=embutida, nome="Muda", dia_inicio=0, dia_fim=10)

    response = client.patch(f"/api/culturas/{embutida.id}/", {"nome": "Pimentao Editado"}, format="json")

    assert response.status_code == 403


def test_excluir_cultura_embutida_retorna_403(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    embutida = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    response = client.delete(f"/api/culturas/{embutida.id}/")

    assert response.status_code == 403
    assert Cultura.objects.filter(id=embutida.id).exists()


def test_excluir_cultura_propria_sem_uso_funciona(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    criada = client.post("/api/culturas/", _payload_valido(), format="json").data

    response = client.delete(f"/api/culturas/{criada['id']}/")

    assert response.status_code == 204
    assert not Cultura.objects.filter(id=criada["id"]).exists()


def test_editar_cultura_com_fase_incompleta_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    criada = client.post("/api/culturas/", _payload_valido(), format="json").data

    response = client.patch(
        f"/api/culturas/{criada['id']}/",
        {"fases": [{"nome": "Fase sem dia_fim", "dia_inicio": 0}]},
        format="json",
    )

    assert response.status_code == 400
    assert "fases" in response.data


def test_editar_cultura_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client1 = criar_usuario_autenticado("produtor1")
    _, client2 = criar_usuario_autenticado("produtor2")
    criada = client1.post("/api/culturas/", _payload_valido(), format="json").data

    response = client2.patch(f"/api/culturas/{criada['id']}/", {"nome": "Nome alterado"}, format="json")

    assert response.status_code == 404


def test_excluir_cultura_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client1 = criar_usuario_autenticado("produtor1")
    _, client2 = criar_usuario_autenticado("produtor2")
    criada = client1.post("/api/culturas/", _payload_valido(), format="json").data

    response = client2.delete(f"/api/culturas/{criada['id']}/")

    assert response.status_code == 404
    assert Cultura.objects.filter(id=criada["id"]).exists()
