import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def _criar_usuario():
    return get_user_model().objects.create_user(username="produtor1", password="senha123")


def test_login_com_credenciais_corretas_retorna_access_e_cookie_refresh():
    usuario = _criar_usuario()
    client = APIClient()

    response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})

    assert response.status_code == 200
    assert "access" in response.data
    assert response.data["user"] == {"id": usuario.id, "username": "produtor1"}
    assert "refresh" not in response.data
    assert "refresh" in response.cookies
    assert response.cookies["refresh"]["httponly"] is True


def test_login_com_senha_errada_retorna_401():
    _criar_usuario()
    client = APIClient()

    response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha_errada"})

    assert response.status_code == 401
