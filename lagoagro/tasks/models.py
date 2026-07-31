from django.db import models


class Tarefa(models.Model):
    plantio = models.ForeignKey("plantings.Plantio", on_delete=models.CASCADE, related_name="tarefas")
    descricao = models.CharField(max_length=255)
    data = models.DateField()
    concluida = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.descricao} ({self.data})"
