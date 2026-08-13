"""Backend de búsqueda sobre Meilisearch.

Aporta ranking por relevancia y autocomplete tolerante a typos, que Postgres con
`LIKE` no da. A cambio, el orden no es estable por `id`, así que la paginación es
por página y no por keyset — el cursor opaco absorbe esa diferencia.

Los nombres de atributo salen de las claves de `filter_category`, validadas
contra `FILTERABLE` al arrancar. No hay forma de que una clave arbitraria acabe
en la expresión de filtro.
"""

from collections.abc import Mapping, Sequence

from src.search.backend import SearchPage
from src.search.client import MeiliClient
from src.search.cursors import InvalidCursorError, decode_cursor, encode_cursor

CURSOR_KIND = "page"
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
    ) -> SearchPage:
        # Meilisearch numera las páginas desde 1; `page=0` solo puede venir de un
        # cursor manipulado.
        page = decode_cursor(cursor, CURSOR_KIND) if cursor else 1
        if page < 1:
            raise InvalidCursorError(cursor or "")
        result = self._client.search(self._index, q, build_filter(filters), page, limit)

        has_more = page < result.total_pages
        return SearchPage(
            ids=result.ids,
            total=result.total_hits,
            next_cursor=encode_cursor(CURSOR_KIND, page + 1) if has_more else None,
        )
