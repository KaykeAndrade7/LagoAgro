# Fica aqui (e nao em domain/) porque le e escreve no banco - nao e calculo
# puro, entao nao se encaixa na regra de domain/ ser testavel sem banco/Django.
from django.db import transaction
from django.db.models import Max, Min, Sum
from django.utils import timezone

from .models import Diaria, LancamentoFinanceiro


# Tudo-ou-nada: uma falha no meio do loop nao pode deixar um lancamento orfao
# com as diarias daquele plantio ainda marcadas como pendentes (double-booking
# na proxima chamada).
# Invariante nao verificada aqui: assume que toda Diaria de `trabalhador` tem
# plantio pertencente ao mesmo usuario do trabalhador - isso e garantido pela
# validacao de FKs na API (serializers), nao por esta funcao.
@transaction.atomic
def pagar_diarias_pendentes(trabalhador):
    diarias_pendentes = Diaria.objects.filter(trabalhador=trabalhador, lancamento__isnull=True)
    # order_by() limpa o ordering padrao (Meta.ordering = ["-data"]) so para esta
    # consulta: com distinct() ativo, Django inclui os campos de order_by no SELECT,
    # o que faria o distinct considerar (plantio_id, data) em vez de so plantio_id.
    plantio_ids_pendentes = list(
        diarias_pendentes.order_by().values_list("plantio_id", flat=True).distinct()
    )

    lancamentos_criados = []
    for plantio_id in plantio_ids_pendentes:
        diarias_do_plantio = diarias_pendentes.filter(plantio_id=plantio_id)
        agregado = diarias_do_plantio.aggregate(total=Sum("valor"), inicio=Min("data"), fim=Max("data"))

        lancamento = LancamentoFinanceiro.objects.create(
            plantio_id=plantio_id,
            valor=agregado["total"],
            data=timezone.localdate(),
            descricao=(
                f"Pagamento de diárias - {trabalhador.nome} "
                f"({agregado['inicio']:%d/%m/%Y} a {agregado['fim']:%d/%m/%Y})"
            ),
            setor="mao_de_obra",
        )
        diarias_do_plantio.update(lancamento=lancamento)
        lancamentos_criados.append(lancamento)

    return lancamentos_criados
