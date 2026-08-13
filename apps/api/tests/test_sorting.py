"""Ordenación server-side y su interacción con la paginación por cursor.

La combinación orden + keyset es la que puede fallar en silencio: si el keyset
no incluye el desempate por `id`, dos filas con el mismo valor de orden pueden
repetirse o perderse al cambiar de página, y el usuario no lo nota.
"""

import pytest
from fastapi.testclient import TestClient

from src.repositories import SORTABLE, SortSpec
from src.services.filters import UnknownSortKeyError, parse_sort

URL = "/api/v1/logs"
TOTAL_SEEDED = 5


def _get(client: TestClient, params: list[tuple[str, str]]) -> dict:
    response = client.get(URL, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _ids(body: dict) -> list[str]:
    return [item["id"] for item in body["items"]]


# ── parseo y validación ───────────────────────────────────────────────────────


def test_no_sort_means_none() -> None:
    assert parse_sort("", "asc") is None


def test_parses_direction() -> None:
    assert parse_sort("event_id", "asc") == SortSpec("event_id", descending=False)
    assert parse_sort("event_id", "desc") == SortSpec("event_id", descending=True)


def test_unknown_sort_key_is_rejected_not_ignored() -> None:
    """Mismo criterio que con los filtros: ordenar mal en silencio es peor que fallar."""
    with pytest.raises(UnknownSortKeyError):
        parse_sort("no_existe", "asc")


def test_every_sortable_key_has_a_binding() -> None:
    for key, binding in SORTABLE.items():
        assert binding.key == key
        assert binding.document_field


# ── endpoint ──────────────────────────────────────────────────────────────────


def test_sorts_ascending_by_log_source(client: TestClient) -> None:
    names = [i["log_source_name"] for i in _get(client, [("sort", "log_source_name")])["items"]]
    assert names == sorted(names)


def test_sorts_descending(client: TestClient) -> None:
    params = [("sort", "log_source_name"), ("sort_dir", "desc")]
    names = [i["log_source_name"] for i in _get(client, params)["items"]]
    assert names == sorted(names, reverse=True)


def test_sorting_does_not_change_the_total(client: TestClient) -> None:
    assert _get(client, [("sort", "event_id")])["total"] == TOTAL_SEEDED


def test_sorting_combines_with_filters(client: TestClient) -> None:
    params = [("sort", "event_id"), ("filter[platform]", "Windows")]
    body = _get(client, params)
    assert body["total"] == 3
    event_ids = [i["event_id"] for i in body["items"]]
    assert event_ids == sorted(event_ids)


def test_unknown_sort_key_returns_400(client: TestClient) -> None:
    response = client.get(URL, params=[("sort", "no_existe")])
    assert response.status_code == 400
    assert response.json()["code"] == "unknown_sort_key"


def test_relevance_is_not_sortable(client: TestClient) -> None:
    """La UI ya no lo ofrece; si alguien lo fuerza por URL, se entera."""
    response = client.get(URL, params=[("sort", "relevance")])
    assert response.status_code == 400


def test_invalid_direction_is_rejected(client: TestClient) -> None:
    assert client.get(URL, params=[("sort_dir", "sideways")]).status_code == 422


# ── ordenación + cursor ───────────────────────────────────────────────────────


def test_paginating_a_sorted_listing_visits_every_row_once(client: TestClient) -> None:
    seen: list[str] = []
    cursor: str | None = None
    for _ in range(TOTAL_SEEDED + 1):
        params = [("limit", "2"), ("sort", "log_source_name")]
        if cursor:
            params.append(("cursor", cursor))
        body = _get(client, params)
        seen.extend(_ids(body))
        cursor = body["next_cursor"]
        if cursor is None:
            break

    assert cursor is None, "la paginación ordenada no terminó"
    assert len(seen) == TOTAL_SEEDED
    assert len(set(seen)) == TOTAL_SEEDED, "una fila apareció en dos páginas"


def test_sorted_pagination_preserves_the_order_across_pages(client: TestClient) -> None:
    """El desempate por `id` hace que el corte de página no rompa el orden."""
    values: list[str] = []
    cursor: str | None = None
    while True:
        params = [("limit", "2"), ("sort", "log_source_name")]
        if cursor:
            params.append(("cursor", cursor))
        body = _get(client, params)
        values.extend(i["log_source_name"] for i in body["items"])
        cursor = body["next_cursor"]
        if cursor is None:
            break

    assert values == sorted(values)


def test_descending_pagination_also_walks_every_row(client: TestClient) -> None:
    seen: list[str] = []
    cursor: str | None = None
    while True:
        params = [("limit", "2"), ("sort", "log_source_name"), ("sort_dir", "desc")]
        if cursor:
            params.append(("cursor", cursor))
        body = _get(client, params)
        seen.extend(_ids(body))
        cursor = body["next_cursor"]
        if cursor is None:
            break

    assert len(set(seen)) == TOTAL_SEEDED


def test_a_cursor_from_a_different_sort_is_rejected(client: TestClient) -> None:
    """Cambiar de columna a media paginación invalida el cursor en vez de mezclar."""
    first = _get(client, [("limit", "2"), ("sort", "log_source_name")])
    response = client.get(
        URL, params=[("limit", "2"), ("sort", "event_id"), ("cursor", first["next_cursor"])]
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_cursor"


def test_a_cursor_from_the_same_column_but_other_direction_is_rejected(
    client: TestClient,
) -> None:
    first = _get(client, [("limit", "2"), ("sort", "log_source_name")])
    response = client.get(
        URL,
        params=[
            ("limit", "2"),
            ("sort", "log_source_name"),
            ("sort_dir", "desc"),
            ("cursor", first["next_cursor"]),
        ],
    )
    assert response.status_code == 400


def test_an_unsorted_cursor_is_rejected_once_you_sort(client: TestClient) -> None:
    first = _get(client, [("limit", "2")])
    response = client.get(
        URL, params=[("limit", "2"), ("sort", "event_id"), ("cursor", first["next_cursor"])]
    )
    assert response.status_code == 400
