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


def test_refresh_com_cookie_valido_retorna_novo_access_e_rotaciona_cookie():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    cookie_antigo = login_response.cookies["refresh"].value

    refresh_response = client.post("/api/auth/refresh/")

    assert refresh_response.status_code == 200
    assert "access" in refresh_response.data
    assert "refresh" not in refresh_response.data
    assert refresh_response.cookies["refresh"].value != cookie_antigo


def test_refresh_sem_cookie_retorna_401():
    client = APIClient()

    response = client.post("/api/auth/refresh/")

    assert response.status_code == 401


def test_reusar_refresh_token_ja_rotacionado_retorna_401():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    token_antigo = login_response.cookies["refresh"].value

    client.post("/api/auth/refresh/")  # rotaciona - client.cookies fica com o token novo

    client.cookies["refresh"] = token_antigo  # forca reenvio do token antigo (ja rotacionado)
    response = client.post("/api/auth/refresh/")

    assert response.status_code == 401


def test_refresh_com_cookie_vazio_e_tratado_como_ausente():
    client = APIClient()
    client.cookies["refresh"] = ""

    response = client.post("/api/auth/refresh/")

    assert response.status_code == 401


def test_logout_invalida_refresh_token_impedindo_reuso():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    access = login_response.data["access"]
    token_antes_do_logout = login_response.cookies["refresh"].value
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    logout_response = client.post("/api/auth/logout/")
    assert logout_response.status_code == 200

    client.cookies["refresh"] = token_antes_do_logout  # forca o token que o logout deveria ter invalidado
    refresh_response = client.post("/api/auth/refresh/")
    assert refresh_response.status_code == 401


def test_logout_sem_cookie_refresh_ainda_retorna_200():
    _criar_usuario()
    client = APIClient()
    login_response = client.post("/api/auth/login/", {"username": "produtor1", "password": "senha123"})
    access = login_response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    client.cookies.pop("refresh", None)

    response = client.post("/api/auth/logout/")

    assert response.status_code == 200
