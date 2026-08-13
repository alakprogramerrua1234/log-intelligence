"""Contrato de búsqueda: qué detecciones casan, en qué orden, y cómo seguir.

El seam es deliberadamente estrecho — el backend responde con **ids**, no con
filas. Hidratar es cosa del repositorio. Así Meilisearch puede aportar ranking y
Postgres orden estable sin que ninguno de los dos necesite conocer la forma de
la respuesta HTTP ni los joins de dimensiones.
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

        `sort` a `None` deja que el backend use su orden natural: `id` en
        Postgres, relevancia en Meilisearch.
        """
        ...
