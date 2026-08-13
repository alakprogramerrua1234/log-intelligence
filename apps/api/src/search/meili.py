"""Backend de búsqueda sobre Meilisearch.

Aporta ranking por relevancia y autocomplete tolerante a typos, que Postgres con
`LIKE` no da. A cambio, sin ordenación explícita el orden es por relevancia y no
hay clave estable para keyset, así que la paginación es por página. El cursor
opaco absorbe esa diferencia.

Los nombres de atributo salen de las claves de `filter_category` y de `SORTABLE`,
validadas contra el código al arrancar. No hay forma de que una clave arbitraria
acabe en la expresión de filtro ni en el `sort`.
"""

from collections.abc import Mapping, Sequence

from src.repositories import SORTABLE, SortSpec
from src.search.backend import SearchPage
from src.search.client import MeiliClient
from src.search.cursors import InvalidCursorError, cursor_int, decode_cursor, encode_cursor

RELEVANCE_CURSOR_KIND = "page"
DEFAULT_INDEX = "detections"


def quote_value(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def build_filter(filters: Mapping[str, Sequence[str]]) -> str:
    """`platform IN ["Windows","Linux"] AND tactic IN ["execution"]`.

    OR dentro de una categoría, AND entre categorías — la misma semántica que el
    backend de Postgres. Las claves se recorren ordenadas para que la expresión
    sea determinista y testeable.
    """
    clauses = [
        f"{key} IN [{','.join(quote_value(v) for v in filters[key])}]"
        for key in sorted(filters)
        if filters[key]
    ]
    return " AND ".join(clauses)


def build_sort(sort: SortSpec | None) -> list[str]:
    """Meilisearch espera `["campo:asc"]`. Sin ordenación, lista vacía = relevancia."""
    if sort is None:
        return []
    field = SORTABLE[sort.key].document_field
    return [f"{field}:{'desc' if sort.descending else 'asc'}"]


def _cursor_kind(sort: SortSpec | None) -> str:
    return sort.cursor_kind if sort else RELEVANCE_CURSOR_KIND


class MeilisearchBackend:
    def __init__(self, client: MeiliClient, index: str = DEFAULT_INDEX) -> None:
        self._client = client
        self._index = index

    def search(
        self,
        q: str,
        filters: Mapping[str, Sequence[str]],
        limit: int,
        cursor: str | None,
        sort: SortSpec | None = None,
    ) -> SearchPage:
        kind = _cursor_kind(sort)
        # Meilisearch numera las páginas desde 1; `page=0` solo puede venir de un
        # cursor manipulado.
        page = 1
        if cursor:
            page = cursor_int(decode_cursor(cursor, kind), "page", cursor)
            if page < 1:
                raise InvalidCursorError(cursor)

        result = self._client.search(
            self._index, q, build_filter(filters), page, limit, build_sort(sort)
        )

        has_more = page < result.total_pages
        return SearchPage(
            ids=result.ids,
            total=result.total_hits,
            next_cursor=encode_cursor(kind, page=page + 1) if has_more else None,
        )
