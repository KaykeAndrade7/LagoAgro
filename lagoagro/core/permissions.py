class UsuarioScopedQuerySetMixin:
    usuario_lookup = "usuario"

    def get_queryset(self):
        return super().get_queryset().filter(**{self.usuario_lookup: self.request.user})
