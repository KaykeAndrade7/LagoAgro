from rest_framework import viewsets

from .models import Cultura
from .serializers import CulturaSerializer


class CulturaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cultura.objects.all()
    serializer_class = CulturaSerializer
