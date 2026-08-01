from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from notifications.models import PushSubscription


def test_registrar_subscription_associa_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()

    response = client.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "chave-p256dh", "auth": "chave-auth",
    })

    assert response.status_code == 201
    assert response.data["id"] is not None
    assert PushSubscription.objects.get(endpoint="https://push.example/1").usuario == usuario


def test_reregistrar_mesmo_endpoint_atualiza_em_vez_de_duplicar(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    client.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "chave-antiga", "auth": "auth-antiga",
    })

    response = client.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "chave-nova", "auth": "auth-nova",
    })

    assert response.status_code == 201
    assert PushSubscription.objects.filter(endpoint="https://push.example/1").count() == 1
    assert PushSubscription.objects.get(endpoint="https://push.example/1").p256dh == "chave-nova"


def test_reregistrar_endpoint_de_outra_conta_reatribui_dono(criar_usuario_autenticado):
    _, client1 = criar_usuario_autenticado("produtor1")
    usuario2, client2 = criar_usuario_autenticado("produtor2")
    client1.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "a", "auth": "b",
    })

    client2.post("/api/push-subscriptions/", {
        "endpoint": "https://push.example/1", "p256dh": "c", "auth": "d",
    })

    assert PushSubscription.objects.get(endpoint="https://push.example/1").usuario == usuario2
    assert PushSubscription.objects.count() == 1


def test_listar_subscriptions_so_retorna_do_usuario_autenticado(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")
    PushSubscription.objects.create(usuario=outro, endpoint="https://push.example/2", p256dh="c", auth="d")

    response = client.get("/api/push-subscriptions/")

    assert response.status_code == 200
    assert len(response.data) == 1


def test_deletar_subscription_propria_funciona(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    subscription = PushSubscription.objects.create(usuario=usuario, endpoint="https://push.example/1", p256dh="a", auth="b")

    response = client.delete(f"/api/push-subscriptions/{subscription.id}/")

    assert response.status_code == 204
    assert not PushSubscription.objects.filter(id=subscription.id).exists()


def test_acessar_subscription_de_outro_usuario_retorna_404(criar_usuario_autenticado):
    _, client = criar_usuario_autenticado()
    outro = get_user_model().objects.create_user(username="produtor2", password="senha123")
    subscription_outro = PushSubscription.objects.create(usuario=outro, endpoint="https://push.example/1", p256dh="a", auth="b")

    response = client.get(f"/api/push-subscriptions/{subscription_outro.id}/")

    assert response.status_code == 404


def test_requisicao_sem_token_retorna_401():
    client = APIClient()

    response = client.get("/api/push-subscriptions/")

    assert response.status_code == 401
