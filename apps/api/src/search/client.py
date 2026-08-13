"""Cliente HTTP mínimo de Meilisearch.

Sobre `httpx` en vez del SDK oficial: la superficie que necesitamos son cuatro
endpoints REST estables, y así el contrato de red queda explícito en el repo —
que es justo lo que documenta ARCHITECTURE.md §5. Menos capas que auditar.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

import httpx


class MeiliError(RuntimeError):
    """Meilisearch respondió con un error, o no respondió."""


@dataclass(frozen=True)
class SearchResult:
    ids: list[int]
    total_hits: int
    total_pages: int


class MeiliClient(Protocol):
    """Lo que el backend de búsqueda y el indexador necesitan de Meilisearch."""

    def search(
        self,
        index: str,
        q: str,
        filter_expression: str,
        page: int,
        hits_per_page: int,
        sort: Sequence[str] = (),
    ) -> SearchResult: ...

    def ensure_index(self, index: str, primary_key: str) -> None: ...

    def update_settings(
        self,
        index: str,
        filterable: Sequence[str],
        searchable: Sequence[str],
        sortable: Sequence[str] = (),
    ) -> None: ...

    def replace_documents(self, index: str, documents: Iterable[Mapping[str, Any]]) -> int: ...


class HttpMeiliClient:
    def __init__(self, base_url: str, api_key: str, timeout: float = 10.0) -> None:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._http = httpx.Client(base_url=base_url.rstrip("/"), headers=headers, timeout=timeout)

    def close(self) -> None:
        self._http.close()

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = self._http.request(method, path, **kwargs)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise MeiliError(
                f"{method} {path} -> {exc.response.status_code}: {exc.response.text[:300]}"
            ) from exc
        except httpx.HTTPError as exc:
            raise MeiliError(f"{method} {path} falló: {exc}") from exc
        return response.json() if response.content else None

    def search(
        self,
        index: str,
        q: str,
        filter_expression: str,
        page: int,
        hits_per_page: int,
        sort: Sequence[str] = (),
    ) -> SearchResult:
        # `page`/`hitsPerPage` en vez de `offset`/`limit`: es la forma de obtener
        # `totalHits` exacto. Con offset/limit Meilisearch solo da una estimación,
        # y el contador de la UI ("N logs") no puede ser una estimación.
        body: dict[str, Any] = {
            "q": q,
            "page": page,
            "hitsPerPage": hits_per_page,
            "attributesToRetrieve": ["id"],
        }
        if filter_expression:
            body["filter"] = filter_expression
        if sort:
            body["sort"] = list(sort)

        payload = self._request("POST", f"/indexes/{index}/search", json=body)
        hits = payload.get("hits", [])
        return SearchResult(
            ids=[int(hit["id"]) for hit in hits],
            total_hits=int(payload.get("totalHits", len(hits))),
            total_pages=int(payload.get("totalPages", 1)),
        )

    def ensure_index(self, index: str, primary_key: str) -> None:
        try:
            self._request("POST", "/indexes", json={"uid": index, "primaryKey": primary_key})
        except MeiliError as exc:
            # index_already_exists es el caso normal en un reindex.
            if "index_already_exists" not in str(exc):
                raise

    def update_settings(
        self,
        index: str,
        filterable: Sequence[str],
        searchable: Sequence[str],
        sortable: Sequence[str] = (),
    ) -> None:
        self._request(
            "PATCH",
            f"/indexes/{index}/settings",
            json={
                "filterableAttributes": list(filterable),
                "searchableAttributes": list(searchable),
                "sortableAttributes": list(sortable),
            },
        )

    def replace_documents(self, index: str, documents: Iterable[Mapping[str, Any]]) -> int:
        batch = list(documents)
        if not batch:
            return 0
        self._request("PUT", f"/indexes/{index}/documents", json=batch)
        return len(batch)
