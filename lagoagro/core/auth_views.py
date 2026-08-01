from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


REFRESH_COOKIE_NAME = "refresh"


def _set_refresh_cookie(response, token):
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        str(token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _delete_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE_NAME, samesite=settings.REFRESH_COOKIE_SAMESITE)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        refresh = data["refresh"]
        access = data["access"]
        usuario = serializer.user

        response = Response({
            "access": access,
            "user": {"id": usuario.id, "username": usuario.username},
        })
        _set_refresh_cookie(response, refresh)
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh_token:
            raise AuthenticationFailed("Refresh token nao encontrado.")

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        data = serializer.validated_data
        novo_refresh = data["refresh"]
        access = data["access"]

        response = Response({"access": access})
        _set_refresh_cookie(response, novo_refresh)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass  # token ja invalido/expirado - nada a fazer, logout eh idempotente

        response = Response(status=status.HTTP_200_OK)
        _delete_refresh_cookie(response)
        return response


class MeView(APIView):
    def get(self, request):
        return Response({"id": request.user.id, "username": request.user.username})
