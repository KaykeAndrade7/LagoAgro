from decimal import Decimal

from django.conf import settings
from django.db import models


class Propriedade(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="propriedades"
    )
    nome = models.CharField(max_length=100)

    def __str__(self):
        return self.nome


class TalhaoManager(models.Manager):
    def create(self, **kwargs):
        if 'area' in kwargs:
            kwargs['area'] = Decimal(str(kwargs['area']))
        return super().create(**kwargs)


class Talhao(models.Model):
    propriedade = models.ForeignKey(Propriedade, on_delete=models.CASCADE, related_name="talhoes")
    nome = models.CharField(max_length=100)
    area = models.DecimalField(max_digits=10, decimal_places=2)  # hectares
    tipo_solo = models.CharField(max_length=100)

    objects = TalhaoManager()

    def __str__(self):
        return f"{self.nome} ({self.propriedade.nome})"
