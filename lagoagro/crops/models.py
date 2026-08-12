from django.conf import settings
from django.db import models


class Cultura(models.Model):
    # usuario nulo = catalogo embutido (pimentao, tomate, batata no MVP,
    # populado por seed_culturas), visivel e listavel por qualquer conta,
    # nunca editavel/excluivel pela API. usuario preenchido = variedade
    # cadastrada pela propria conta, visivel so a ela, com CRUD completo.
    # Ver docs/adr/010-cultura-deixa-de-ser-excecao-multi-tenant.md.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="culturas"
    )
    nome = models.CharField(max_length=100)
    ciclo_dias = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["usuario", "nome"], name="unique_cultura_por_usuario"),
        ]

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
