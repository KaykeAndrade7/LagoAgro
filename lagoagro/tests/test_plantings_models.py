import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError

from crops.models import Cultura
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def _criar_talhao():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    return Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area="2.50", tipo_solo="argiloso")


def test_plantio_liga_talhao_e_cultura_com_status_padrao():
    talhao = _criar_talhao()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)

    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    assert plantio.talhao == talhao
    assert plantio.cultura == cultura
    assert plantio.status == "em_andamento"


def test_deletar_talhao_deleta_plantio_em_cascata():
    talhao = _criar_talhao()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    talhao.delete()

    assert Plantio.objects.count() == 0


def test_deletar_cultura_em_uso_por_plantio_e_protegido():
    # Cultura e catalogo compartilhado (Task 2) - nao pode sumir silenciosamente
    # e arrastar plantios historicos junto.
    talhao = _criar_talhao()
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")

    with pytest.raises(ProtectedError):
        cultura.delete()
