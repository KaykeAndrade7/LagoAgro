from django.contrib import admin

from .models import AplicacaoInsumo, Insumo

admin.site.register(Insumo)
admin.site.register(AplicacaoInsumo)
