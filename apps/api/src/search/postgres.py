"""Backend de búsqueda sobre Postgres.

Paginación por keyset: el coste no crece con la profundidad de la página, a
diferencia de `OFFSET`. Sin ordenación explícita el keyset va sobre `id`; con
ordenación, sobre `(columna, id)` — ver `DetectionRepository.matching`.

No ejecuta SQL: compone `DetectionRepository`. La frontera de persistencia sigue
siendo `repositories/`.

`q` se resuelve con `LIKE '%término%'` sobre las columnas filtrables. El comodín
inicial impide usar índice, así que es un escaneo — irrelevante con el volumen
actual (miles de filas). Si el dataset crece un orden de magnitud, el primer
paso es un índice GIN con `pg_trgm`, que además daría tolerancia a erratas.
"""

from collections.abc import Mapping, Sequence

from src.repositories import DetectionRepository, MatchRow, SortSpec
from src.search.backend import SearchPage
from src.search.cursors import cursor_int, cursor_str, decode_cursor, encode_cursor

UNSORTED_CURSOR_KIND = "id"


def _cursor_kind(sort: SortSpec | None) -> str:
    return sort.cursor_kind if sort else UNSORTED_CURSOR_KIND


class PostgresSearchBackend:
    def __init__(self, detections: DetectionRepository) -> None:
        self._detections = detections

    def search(
        self,
        q: str,
        filters: Mapping[str, Sequence[str]],
        limit: int,
        cursor: str | None,
        sort: SortSpec | None = None,
    ) -> SearchPage:
        kind = _cursor_kind(sort)
        after: MatchRow | None = None
        if cursor:
            fields = decode_cursor(cursor, kind)
            after = MatchRow(
                id=cursor_int(fields, "id", cursor),
                sort_value=cursor_str(fields, "v", cursor),
            )

        # limit + 1 para saber si hay página siguiente sin una query extra.
        rows = self._detections.matching(filters, q, limit + 1, after, sort)
        has_more = len(rows) > limit
        page = rows[:limit]

        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = encode_cursor(kind, id=last.id, v=last.sort_value)

        return SearchPage(
            ids=[row.id for row in page],
            total=self._detections.count(filters, q),
            next_cursor=next_cursor,
        )
