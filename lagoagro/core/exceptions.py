from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Exception handler customizado (ver REST_FRAMEWORK['EXCEPTION_HANDLER']).

    DRF nao tem tratamento built-in para ProtectedError - alguns FKs de
    catalogo (Insumo, Cultura) ainda usam on_delete=PROTECT pra nao sumir
    do catalogo do usuario enquanto em uso (ADR 007/008; ADR 009 reverteu
    o PROTECT dos FKs de Plantio/Trabalhador/LancamentoFinanceiro, que
    hoje sao CASCADE/SET_NULL), entao deletar um objeto ainda referenciado
    por um desses FKs de catalogo precisa virar 409 (Conflict) em vez de
    estourar um 500.
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
