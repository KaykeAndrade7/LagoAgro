from django.db import models


class Plantio(models.Model):
    STATUS_CHOICES = [
        ("em_andamento", "Em andamento"),
        ("colhido", "Colhido"),
        ("cancelado", "Cancelado"),
    ]

    talhao = models.ForeignKey("properties.Talhao", on_delete=models.CASCADE, related_name="plantios")
    cultura = models.ForeignKey("crops.Cultura", on_delete=models.PROTECT, related_name="plantios")
    data_plantio = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="em_andamento")

    def __str__(self):
        return f"{self.cultura.nome} em {self.talhao.nome} ({self.data_plantio})"
