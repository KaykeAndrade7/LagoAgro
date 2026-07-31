import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture
def criar_usuario_autenticado(db):
    def _criar(username="produtor1"):
        usuario = get_user_model().objects.create_user(username=username, password="senha123")
        client = APIClient()
        login = client.post("/api/auth/login/", {"username": username, "password": "senha123"})
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        return usuario, client

    return _criar
