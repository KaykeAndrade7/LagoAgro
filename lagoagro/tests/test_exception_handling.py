from decimal import Decimal

from crops.models import Cultura
from finance.models import LancamentoFinanceiro
from inputs.models import AplicacaoInsumo, Insumo
from plantings.models import Plantio
from properties.models import Propriedade, Talhao


def _criar_plantio(usuario):
    propriedade = Propriedade.objects.create(usuario=usuario, nome="Sitio Boa Vista")
    talhao = Talhao.objects.create(propriedade=propriedade, nome="Talhao 1", area=Decimal("2.50"), tipo_solo="argiloso")
    cultura, _ = Cultura.objects.get_or_create(nome="Pimentao", defaults={"ciclo_dias": 90})
    return Plantio.objects.create(talhao=talhao, cultura=cultura, data_plantio="2026-01-01")


def test_deletar_plantio_com_lancamento_vinculado_deleta_em_cascata(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    lancamento = LancamentoFinanceiro.objects.create(
        plantio=plantio, valor="150.00", data="2026-01-15", descricao="Compra de mudas", setor="insumos"
    )

    response = client.delete(f"/api/plantios/{plantio.id}/")

    assert response.status_code == 204
    assert not LancamentoFinanceiro.objects.filter(id=lancamento.id).exists()


def test_deletar_insumo_com_aplicacao_vinculada_retorna_409(criar_usuario_autenticado):
    usuario, client = criar_usuario_autenticado()
    plantio = _criar_plantio(usuario)
    insumo = Insumo.objects.create(usuario=usuario, nome="ProdutoX", tipo="veneno", carencia_dias=7)
    AplicacaoInsumo.objects.create(plantio=plantio, insumo=insumo, data="2026-02-01", quantidade=Decimal("1.50"))

    response = client.delete(f"/api/insumos/{insumo.id}/")

    assert response.status_code == 409
    assert "detail" in response.data
