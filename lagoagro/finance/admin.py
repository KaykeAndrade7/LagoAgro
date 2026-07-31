from django.contrib import admin

from .models import Diaria, LancamentoFinanceiro, Trabalhador

admin.site.register(LancamentoFinanceiro)
admin.site.register(Trabalhador)
admin.site.register(Diaria)
