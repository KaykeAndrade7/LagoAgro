from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


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
        response.set_cookie(
            "refresh",
            str(refresh),
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
        )
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get("refresh")
        if refresh_token is None:
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
        response.set_cookie(
            "refresh",
            str(novo_refresh),
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
        )
        return response
