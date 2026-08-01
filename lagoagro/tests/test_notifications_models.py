import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

pytestmark = pytest.mark.django_db


def test_criar_subscription_associa_usuario_e_tem_timestamp():
    from notifications.models import PushSubscription

    usuario = get_user_model().objects.create_user(username="produtor1", password="senha123")

    subscription = PushSubscription.objects.create(
        usuario=usuario,
        endpoint="https://push.example/1",
        p256dh="chave-p256dh",
        auth="chave-auth",
    )

    assert subscription.usuario == usuario
    assert subscription.criado_em is not None
    assert usuario.push_subscriptions.count() == 1


def test_endpoint_e_unico():
    from notifications.models import PushSubscription

    usuario1 = get_user_model().objects.create_user(username="produtor1", password="senha123")
    usuario2 = get_user_model().objects.create_user(username="produtor2", password="senha123")
    PushSubscription.objects.create(usuario=usuario1, endpoint="https://push.example/1", p256dh="a", auth="b")

    with pytest.raises(IntegrityError):
        PushSubscription.objects.create(usuario=usuario2, endpoint="https://push.example/1", p256dh="c", auth="d")
