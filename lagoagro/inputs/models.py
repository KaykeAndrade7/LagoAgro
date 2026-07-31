from django.conf import settings
from django.db import models


class Insumo(models.Model):
    TIPO_CHOICES = [
        ("veneno", "Veneno"),
        ("adubo", "Adubo"),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="insumos"
    )
    nome = models.CharField(max_length=100)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    carencia_dias = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.nome


class AplicacaoInsumo(models.Model):
    # created_by/created_at: trilha de auditoria (threat-model.md,
    # mitigacao de Repudiation).
    # created_by vira null se a conta do autor for removida (ADR 007); plantio e PROTECT
    # para que a trilha nao suma se o dono do dado apagar o plantio (usar
    # Plantio.status="cancelado" em vez de deletar).
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.PROTECT, related_name="aplicacoes")
    insumo = models.ForeignKey(Insumo, on_delete=models.PROTECT, related_name="aplicacoes")
    data = models.DateField()
    quantidade = models.DecimalField(max_digits=10, decimal_places=2)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="aplicacoes_registradas"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.insumo.nome} em {self.plantio} ({self.data})"
