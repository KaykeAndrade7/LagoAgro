from django.db import models


class LancamentoFinanceiro(models.Model):
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="lancamentos")
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    descricao = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.descricao}: {self.valor} ({self.data})"
