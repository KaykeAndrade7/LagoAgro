from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Anonimiza os dados pessoais de uma conta (username, email, nome, senha), "
        "mantendo a conta e todo o historico operacional associado a ela intactos."
    )

    def add_arguments(self, parser):
        parser.add_argument("user_id", type=int)

    def handle(self, *args, **options):
        User = get_user_model()
        try:
            usuario = User.objects.get(pk=options["user_id"])
        except User.DoesNotExist:
            raise CommandError(f"Usuario {options['user_id']} nao encontrado")

        usuario.username = f"usuario-excluido-{usuario.pk}"
        usuario.email = ""
        usuario.first_name = ""
        usuario.last_name = ""
        usuario.is_active = False
        usuario.set_unusable_password()
        usuario.save()

        self.stdout.write(self.style.SUCCESS(f"Usuario {options['user_id']} anonimizado."))
