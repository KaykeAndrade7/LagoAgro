from django.db import models


class Colheita(models.Model):
    CLASSIFICACAO_CHOICES = [
        ("primeira", "Primeira"),
        ("segunda", "Segunda"),
    ]

    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="colheitas")
    data = models.DateField()
    classificacao = models.CharField(max_length=20, choices=CLASSIFICACAO_CHOICES)
    quantidade = models.DecimalField(max_digits=10, decimal_places=2)  # caixas

    def __str__(self):
        return f"{self.classificacao} - {self.quantidade} ({self.plantio})"
