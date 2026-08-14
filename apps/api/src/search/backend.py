"""Contrato de búsqueda: qué detecciones casan, en qué orden, y cómo seguir.

El seam es deliberadamente estrecho — el backend responde con **ids**, no con
filas. Hidratar es cosa del repositorio, que es quien conoce los joins de
dimensiones; el backend solo decide qué casa y en qué orden.

Hoy la única implementación es `PostgresSearchBackend`. El contrato se mantiene
separado porque es donde vive la paginación por cursor opaco, y porque un motor
de búsqueda dedicado —si el volumen alguna vez lo justifica— entraría por aquí
sin tocar routers, services ni la forma de la respuesta.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol

from src.repositories import SortSpec


@dataclass(frozen=True)
class SearchPage:
    """Una página de resultados: ids en orden, total del conjunto y cómo seguir."""

    ids: list[int]
    total: int
    next_cursor: str | None


class SearchBackend(Protocol):
    """Resuelve "qué detecciones casan con esta query" y pagina el resultado."""

    def search(
        self,
        q: str,
        filters: Mapping[str, Sequence[str]],
        limit: int,
        cursor: str | None,
        sort: SortSpec | None = None,
    ) -> SearchPage:
        """`q` vacío significa "sin búsqueda libre": solo filtros.

        `sort` a `None` deja que el backend use su orden natural — `id` en
        Postgres.
        """
        ...
