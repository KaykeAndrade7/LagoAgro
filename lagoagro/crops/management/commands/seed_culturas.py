from django.core.management.base import BaseCommand
from django.db import transaction

from crops.models import Cultura, FaseCultura

# Culturas do MVP (RF02, docs/requirements.md) com ciclo/fases aproximados -
# valores de referencia comuns pra essas culturas no Brasil, nao um dado
# cientifico fechado. O usuario final pode ajustar dia_inicio/dia_fim/
# ciclo_dias pelo Django admin (/admin/) se a variedade/regiao dele divergir;
# este comando nunca sobrescreve uma cultura ja existente com o mesmo nome.
CULTURAS_MVP = [
    {
        "nome": "Tomate",
        "ciclo_dias": 120,
        "fases": [
            ("Muda", 0, 20),
            ("Vegetativo", 20, 45),
            ("Floração", 45, 70),
            ("Colheita", 70, 120),
        ],
    },
    {
        "nome": "Pimentão",
        "ciclo_dias": 110,
        "fases": [
            ("Muda", 0, 25),
            ("Vegetativo", 25, 50),
            ("Floração", 50, 75),
            ("Colheita", 75, 110),
        ],
    },
    {
        "nome": "Batata",
        "ciclo_dias": 100,
        "fases": [
            ("Plantio", 0, 15),
            ("Vegetativo", 15, 40),
            ("Floração/Tuberização", 40, 65),
            ("Colheita", 65, 100),
        ],
    },
]


class Command(BaseCommand):
    help = "Semeia as culturas do MVP (tomate, pimentão, batata) com suas fases, se ainda não existirem."

    @transaction.atomic
    def handle(self, *args, **options):
        for dados in CULTURAS_MVP:
            cultura, criada = Cultura.objects.get_or_create(
                nome=dados["nome"], defaults={"ciclo_dias": dados["ciclo_dias"]}
            )
            if not criada:
                self.stdout.write(f"'{cultura.nome}' já existe, pulando.")
                continue

            for nome_fase, dia_inicio, dia_fim in dados["fases"]:
                FaseCultura.objects.create(
                    cultura=cultura, nome=nome_fase, dia_inicio=dia_inicio, dia_fim=dia_fim
                )
            self.stdout.write(self.style.SUCCESS(f"'{cultura.nome}' criada com {len(dados['fases'])} fase(s)."))
