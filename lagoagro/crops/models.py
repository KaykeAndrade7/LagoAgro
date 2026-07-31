from django.db import models


class Cultura(models.Model):
    nome = models.CharField(max_length=100, unique=True)
    ciclo_dias = models.PositiveIntegerField()

    def __str__(self):
        return self.nome


class FaseCultura(models.Model):
    cultura = models.ForeignKey(Cultura, on_delete=models.CASCADE, related_name="fases")
    nome = models.CharField(max_length=100)
    dia_inicio = models.PositiveIntegerField()
    dia_fim = models.PositiveIntegerField()

    class Meta:
        ordering = ["dia_inicio"]

    def __str__(self):
        return f"{self.cultura.nome} - {self.nome}"
