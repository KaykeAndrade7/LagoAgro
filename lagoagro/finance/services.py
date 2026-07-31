from django.db.models import Max, Min, Sum
from django.utils import timezone

from .models import Diaria, LancamentoFinanceiro


def pagar_diarias_pendentes(trabalhador):
    diarias_pendentes = Diaria.objects.filter(trabalhador=trabalhador, lancamento__isnull=True)
    plantio_ids_pendentes = diarias_pendentes.values_list("plantio_id", flat=True).distinct()

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
