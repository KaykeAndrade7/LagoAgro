from django.db import models


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

    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="lancamentos")
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    descricao = models.CharField(max_length=255)
    setor = models.CharField(max_length=20, choices=SETOR_CHOICES)

    def __str__(self):
        return f"{self.descricao}: {self.valor} ({self.data})"
