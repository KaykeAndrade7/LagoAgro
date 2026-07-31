import pytest
from django.contrib.auth import get_user_model

from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def test_propriedade_pertence_a_um_usuario():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")

    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    assert propriedade.usuario == usuario
    assert str(propriedade) == "Sitio Boa Vista"


def test_talhao_pertence_a_uma_propriedade():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")

    talhao = Talhao.objects.create(
        propriedade=propriedade, nome="Talhao 1", area="2.50", tipo_solo="argiloso"
    )

    assert talhao.propriedade == propriedade
    assert talhao.area == 2.5


def test_deletar_propriedade_deleta_talhoes_em_cascata():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area="2.50", tipo_solo="argiloso")

    propriedade.delete()

    assert Talhao.objects.count() == 0
