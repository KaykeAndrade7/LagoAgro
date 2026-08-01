from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import Cultura
from plantings.models import Plantio
from properties.models import Propriedade, Talhao
from tasks.models import Tarefa


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura, _ = Cultura.objects.get_or_create(nome="Pimentao", defaults={"ciclo_dias": 90})
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_criar_tarefa_com_plantio_proprio_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)

    response = client.post("/api/tarefas/", {
        "plantio": plantio.id, "descricao": "Aplicar defensivo", "data": "2026-02-01",
    })

    assert response.status_code == 201
    assert response.data["concluida"] is False


def test_criar_tarefa_com_plantio_de_outro_usuario_retorna_400(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)

    response = client.post("/api/tarefas/", {
        "plantio": plantio_outro.id, "descricao": "Aplicar defensivo", "data": "2026-02-01",
    })

    assert response.status_code == 400


def test_listar_tarefas_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio = _criar_plantio(usuario)
    plantio_outro = _criar_plantio(outro)
    Tarefa.objects.create(plantio=plantio, descricao="Minha tarefa", data="2026-02-01")
    Tarefa.objects.create(plantio=plantio_outro, descricao="Tarefa de outro", data="2026-02-01")

    response = client.get("/api/tarefas/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_acessar_tarefa_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    plantio_outro = _criar_plantio(outro)
    tarefa_outro = Tarefa.objects.create(plantio=plantio_outro, descricao="Tarefa de outro", data="2026-02-01")

    response = client.get(f"/api/tarefas/{tarefa_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/tarefas/")

    assert response.status_code == 401
