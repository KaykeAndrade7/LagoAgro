import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError

from crops.models import Cultura
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao

pytestmark = pytest.mark.django_db


def _criar_plantio_e_usuario():
    User = get_user_model()
    usuario = User.objects.create_user(username="produtor1", password="senha123")
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area="2.50", tipo_solo="argiloso")
    cultura = Cultura.objects.create(nome="Pimentao", ciclo_dias=90)
    plantio = Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")
    return usuario, plantio


def test_insumo_pertence_a_um_usuario_e_tem_carencia():
    usuario, _ = _criar_plantio_e_usuario()

    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    assert insumo.usuario == usuario
    assert insumo.carencia_dias == 7


def test_aplicacao_registra_quem_e_quando_criou():
    usuario, plantio = _criar_plantio_e_usuario()
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)

    aplicacao = AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade="1.50", created_by=usuario
    )

    assert aplicacao.created_by == usuario
    assert aplicacao.created_at is not None


def test_deletar_insumo_em_uso_e_protegido():
    usuario, plantio = _criar_plantio_e_usuario()
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade="1.50", created_by=usuario
    )

    with pytest.raises(ProtectedError):
        insumo.delete()


def test_deletar_plantio_deleta_aplicacoes_em_cascata():
    usuario, plantio = _criar_plantio_e_usuario()
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade="1.50", created_by=usuario
    )

    plantio.delete()

    assert AplicacaoInsumo.objects.count() == 0


def test_deletar_autor_da_aplicacao_define_created_by_como_none():
    usuario, plantio = _criar_plantio_e_usuario()
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    funcionario = get_user_model().objects.create_user(username="funcionario1", password="senha123")
    aplicacao = AplicacaoInsumo.objects.create(
        plantio=plantio, insumo=insumo, data="2026-02-01", quantidade="1.50", created_by=funcionario
    )

    funcionario.delete()

    aplicacao.refresh_from_db()
    assert aplicacao.created_by is None
