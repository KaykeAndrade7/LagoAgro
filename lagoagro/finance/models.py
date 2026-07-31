from django.conf import settings
from django.db import models


class Trabalhador(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trabalhadores")
    nome = models.CharField(max_length=100)
    valor_diaria = models.DecimalField(max_digits=10, decimal_places=2)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return self.nome


# trabalhador e plantio sao PROTECT pelo mesmo motivo de AplicacaoInsumo em
# inputs/models.py (ADR 007): a diaria e trilha de pagamento e nao pode sumir
# junto com o registro que ela referencia.
class Diaria(models.Model):
    trabalhador = models.ForeignKey(Trabalhador, on_delete=models.PROTECT, related_name="diarias")
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.PROTECT, related_name="diarias")
    data = models.DateField()
    valor = models.DecimalField(max_digits=10, decimal_places=2, blank=True)
    lancamento = models.ForeignKey(
        "finance.LancamentoFinanceiro",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="diarias_pagas",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["trabalhador", "data"], name="unique_diaria_por_trabalhador_e_dia")
        ]
        ordering = ["-data"]

    def save(self, *args, **kwargs):
        if self._state.adding and self.valor is None:
            self.valor = self.trabalhador.valor_diaria
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.trabalhador.nome} - {self.data}"


class LancamentoFinanceiro(models.Model):
    # Lista generica de setores de gasto (aprovada com o usuario) - cobre mao de
    # obra separadamente dos demais custos, sem precisar de um catalogo a parte.
    SETOR_CHOICES = [
        ("mao_de_obra", "Mão de obra"),
        ("insumos", "Insumos"),
        ("maquinario", "Maquinário/equipamentos"),
        ("transporte", "Transporte/frete"),
        ("manutencao", "Manutenção/infraestrutura"),
        ("outros", "Outros"),
    ]

    # plantio e PROTECT (ADR 008): lancamento e trilha financeira e nao pode
    # sumir junto com o plantio (usar Plantio.status="cancelado" em vez de deletar).
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.PROTECT, related_name="lancamentos")
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    descricao = models.CharField(max_length=255)
    setor = models.CharField(max_length=20, choices=SETOR_CHOICES)

    def __str__(self):
        return f"{self.descricao}: {self.valor} ({self.data})"
