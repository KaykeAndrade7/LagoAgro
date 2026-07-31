from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from properties.models import Propriedade


def test_criar_propriedade_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/propriedades/", {"nome": "Sitio Boa Vista"})

    assert response.status_code == 201
    assert Propriedade.objects.get(id=response.data["id"]).usuario == usuario


def test_listar_propriedades_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    Propriedade.objects.create(usuario=outro, nome="Sitio de outro")
    Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    response = client.get("/api/propriedades/")

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["nome"] == "Sitio Boa Vista"


def test_acessar_propriedade_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")

    response = client.get(f"/api/propriedades/{propriedade_outro.id}/")

    assert response.status_code == 404


def test_criar_talhao_com_propriedade_propria_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    response = client.post("/api/talhoes/", {
        "propriedade": propriedade.id, "nome": "Talhao 1", "area": "2.50", "tipo_solo": "argiloso",
    })

    assert response.status_code == 201


def test_criar_talhao_com_propriedade_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    propriedade_outro = Propriedade.objects.create(usuario=outro, nome="Sitio de outro")

    response = client.post("/api/talhoes/", {
        "propriedade": propriedade_outro.id, "nome": "Talhao X", "area": "1.00", "tipo_solo": "arenoso",
    })

    assert response.status_code == 400


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/propriedades/")

    assert response.status_code == 401
