class UsuarioScopedQuerySetMixin:
    """Restringe o queryset de um viewset ao usuario autenticado.

    `usuario_lookup` eh o caminho (em sintaxe de filtro do ORM) do model ate o
    dono do dado. Para models com FK direta a Usuario, o padrao "usuario" ja
    serve; para models que so tem dono via relacionamento indireto (ex.:
    Talhao -> Propriedade -> Usuario), sobrescreva com algo como
    "propriedade__usuario" no viewset.

    Filtrar aqui, em `get_queryset()`, faz com que um objeto de outro usuario
    simplesmente nao exista para essa query - a view responde 404 em vez de
    403 ao tentar acessar `retrieve`/`update`/`delete` de outro tenant. Isso eh
    proposital: 404 nao revela ao atacante se o recurso existe e pertence a
    outra pessoa (ver mitigacao de IDOR em docs/threat-model.md).

    Cuidado: este mixin so protege LEITURA (o que passa por `get_queryset()`).
    Ele nao valida ownership em escritas - por exemplo, um `perform_create`
    que aceita um `propriedade_id` (ou outro FK) vindo do payload pode
    permitir que um usuario vincule o novo registro a uma propriedade de
    outro usuario. Essa validacao precisa ser feita separadamente, em cada
    viewset que recebe FKs no payload de escrita.
    """

    usuario_lookup = "usuario"

    def get_queryset(self):
        return super().get_queryset().filter(**{self.usuario_lookup: self.request.user})
