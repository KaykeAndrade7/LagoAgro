from django.conf import settings
from django.db import models


class Trabalhador(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trabalhadores")
    nome = models.CharField(max_length=100)
    valor_diaria = models.DecimalField(max_digits=10, decimal_places=2)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return self.nome


# trabalhador e plantio sao CASCADE (ADR 009 - reverte a ADR 007/008): o dono
# da conta pode excluir o trabalhador ou o plantio e as diarias vinculadas
# somem junto. lancamento e SET_NULL: excluir o lancamento (pagamento) nao
# apaga a diaria em si, so desfaz o vinculo - a diaria volta a aparecer como
# pendente de pagamento.
class Diaria(models.Model):
    trabalhador = models.ForeignKey(Trabalhador, on_delete=models.CASCADE, related_name="diarias")
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="diarias")
    data = models.DateField()
    valor = models.DecimalField(max_digits=10, decimal_places=2, blank=True)
    lancamento = models.ForeignKey(
        "finance.LancamentoFinanceiro",
        on_delete=models.SET_NULL,
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
    TIPO_CHOICES = [
        ("gasto", "Gasto"),
        ("ganho", "Ganho"),
    ]

    # Lista generica de setores (aprovada com o usuario) - cobre mao de obra
    # separadamente dos demais custos, sem precisar de um catalogo a parte.
    # "venda_colheita" e "outros" tambem servem pra tipo="ganho" - ver
    # GASTO_SETORES/GANHO_SETORES abaixo pra quais sao validos em cada tipo.
    SETOR_CHOICES = [
        ("mao_de_obra", "Mão de obra"),
        ("insumos", "Insumos"),
        ("maquinario", "Maquinário/equipamentos"),
        ("transporte", "Transporte/frete"),
        ("manutencao", "Manutenção/infraestrutura"),
        ("venda_colheita", "Venda de colheita"),
        ("outros", "Outros"),
    ]

    GASTO_SETORES = {"mao_de_obra", "insumos", "maquinario", "transporte", "manutencao", "outros"}
    GANHO_SETORES = {"venda_colheita", "outros"}

    # plantio e CASCADE (ADR 009 - reverte a ADR 008): o dono da conta pode
    # excluir o plantio e o historico financeiro vinculado some junto.
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="lancamentos")
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default="gasto")
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    descricao = models.CharField(max_length=255)
    setor = models.CharField(max_length=20, choices=SETOR_CHOICES)

    def __str__(self):
        return f"{self.descricao}: {self.valor} ({self.data})"
