from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Exception handler customizado (ver REST_FRAMEWORK['EXCEPTION_HANDLER']).

    DRF nao tem tratamento built-in para ProtectedError - varios FKs do
    dominio usam on_delete=PROTECT (ADR 007/008) para preservar trilhas de
    auditoria/pagamento, entao deletar um objeto ainda referenciado por um
    desses FKs precisa virar 409 (Conflict) em vez de estourar um 500.
    """
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, ProtectedError):
        return Response(
            {"detail": "Não é possível excluir: existem registros vinculados a este item."},
            status=status.HTTP_409_CONFLICT,
        )

    return None
