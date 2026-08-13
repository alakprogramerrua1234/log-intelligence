"""Backend de búsqueda sobre Postgres. Es el camino por defecto.

Paginación por keyset sobre `detection.id`: el coste no crece con la profundidad
de la página, a diferencia de `OFFSET`. El precio es que el orden es por `id`,
no por relevancia — para eso está el backend de Meilisearch.

No ejecuta SQL: compone `DetectionRepository`. La frontera de persistencia sigue
siendo `repositories/`.
"""

from collections.abc import Mapping, Sequence

from src.repositories import DetectionRepository
from src.search.backend import SearchPage
from src.search.cursors import decode_cursor, encode_cursor

CURSOR_KIND = "id"


class PostgresSearchBackend:
    def __init__(self, detections: DetectionRepository) -> None:
        self._detections = detections

    def search(
        self,
        q: str,
        filters: Mapping[str, Sequence[str]],
        limit: int,
        cursor: str | None,
    ) -> SearchPage:
        after_id = decode_cursor(cursor, CURSOR_KIND) if cursor else None

        # limit + 1 para saber si hay página siguiente sin una query extra.
        ids = self._detections.matching_ids(filters, q, limit + 1, after_id)
        has_more = len(ids) > limit
        page = ids[:limit]

        return SearchPage(
            ids=page,
            total=self._detections.count(filters, q),
            next_cursor=encode_cursor(CURSOR_KIND, page[-1]) if has_more and page else None,
        )
