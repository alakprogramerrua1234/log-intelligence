"""Comportamiento de `GET /logs` con el sistema de filtros dinámico."""

from fastapi.testclient import TestClient

from src.search.cursors import encode_cursor

URL = "/api/v1/logs"

TOTAL_SEEDED = 5


def _get(client: TestClient, params: list[tuple[str, str]] | None = None) -> dict:
    response = client.get(URL, params=params or [])
    assert response.status_code == 200, response.text
    return response.json()


def test_returns_every_detection_without_filters(client: TestClient) -> None:
    body = _get(client)
    assert body["total"] == TOTAL_SEEDED
    assert len(body["items"]) == TOTAL_SEEDED


def test_filters_by_category(client: TestClient) -> None:
    body = _get(client, [("filter[platform]", "Windows")])
    assert body["total"] == 3


def test_multiple_values_in_one_category_are_or(client: TestClient) -> None:
    body = _get(client, [("filter[platform]", "Linux"), ("filter[platform]", "AWS")])
    assert body["total"] == 2


def test_different_categories_are_and(client: TestClient) -> None:
    body = _get(
        client,
        [("filter[platform]", "Windows"), ("filter[log_source]", "Windows Security")],
    )
    assert body["total"] == 1
    assert body["items"][0]["event_id"] == "4688"


def test_and_across_categories_can_yield_nothing(client: TestClient) -> None:
    body = _get(client, [("filter[platform]", "Linux"), ("filter[log_source]", "Sysmon")])
    assert body["total"] == 0
    assert body["items"] == []


def test_filter_values_are_case_insensitive(client: TestClient) -> None:
    assert _get(client, [("filter[platform]", "wInDoWs")])["total"] == 3


def test_filters_by_technique_id(client: TestClient) -> None:
    assert _get(client, [("filter[technique]", "T1059")])["total"] == 3


def test_filters_by_subtechnique_id(client: TestClient) -> None:
    assert _get(client, [("filter[subtechnique]", "T1059.001")])["total"] == 1


def test_unknown_category_is_rejected_not_ignored(client: TestClient) -> None:
    """El fallo silencioso que arregla este PR: antes devolvía 200 sin filtrar."""
    response = client.get(URL, params=[("filter[nope]", "x")])
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "unknown_filter_category"
    assert body["keys"] == ["nope"]


def test_unknown_category_rejected_even_alongside_valid_ones(client: TestClient) -> None:
    response = client.get(
        URL, params=[("filter[platform]", "Windows"), ("filter[nope]", "x")]
    )
    assert response.status_code == 400
    assert response.json()["keys"] == ["nope"]


def test_free_text_search_matches_any_filterable_column(client: TestClient) -> None:
    assert _get(client, [("q", "powershell")])["total"] == 1      # nombre de subtécnica
    assert _get(client, [("q", "cloudtrail")])["total"] == 1      # nombre de log source
    assert _get(client, [("q", "linux")])["total"] == 1           # nombre de plataforma


def test_search_combines_with_filters(client: TestClient) -> None:
    body = _get(client, [("q", "powershell"), ("filter[platform]", "Linux")])
    assert body["total"] == 0


def test_limit_caps_items_but_not_total(client: TestClient) -> None:
    body = _get(client, [("limit", "2")])
    assert len(body["items"]) == 2
    assert body["total"] == TOTAL_SEEDED


def test_limit_out_of_range_is_rejected(client: TestClient) -> None:
    assert client.get(URL, params=[("limit", "0")]).status_code == 422
    assert client.get(URL, params=[("limit", "10000")]).status_code == 422


def test_ordering_is_deterministic(client: TestClient) -> None:
    """Necesario para que una URL compartida enseñe lo mismo a todo el mundo."""
    first = [item["id"] for item in _get(client, [("limit", "3")])["items"]]
    second = [item["id"] for item in _get(client, [("limit", "3")])["items"]]
    assert first == second


# ── paginación por cursor ─────────────────────────────────────────────────────


def test_first_page_offers_a_cursor_when_more_remain(client: TestClient) -> None:
    body = _get(client, [("limit", "2")])
    assert len(body["items"]) == 2
    assert body["next_cursor"]


def test_a_full_result_set_has_no_cursor(client: TestClient) -> None:
    assert _get(client, [("limit", str(TOTAL_SEEDED))])["next_cursor"] is None


def test_walking_the_cursor_yields_every_row_exactly_once(client: TestClient) -> None:
    seen: list[str] = []
    cursor: str | None = None
    for _ in range(TOTAL_SEEDED + 1):  # cota: nunca debe hacer falta otra vuelta
        params = [("limit", "2")]
        if cursor:
            params.append(("cursor", cursor))
        body = _get(client, params)
        seen.extend(item["id"] for item in body["items"])
        cursor = body["next_cursor"]
        if cursor is None:
            break

    assert cursor is None, "la paginación no terminó"
    assert len(seen) == TOTAL_SEEDED
    assert len(set(seen)) == TOTAL_SEEDED, "una fila apareció en dos páginas"


def test_cursor_keeps_filters_applied(client: TestClient) -> None:
    first = _get(client, [("limit", "1"), ("filter[platform]", "Windows")])
    assert first["total"] == 3

    second = _get(
        client,
        [("limit", "1"), ("filter[platform]", "Windows"), ("cursor", first["next_cursor"])],
    )
    assert second["total"] == 3
    assert second["items"][0]["id"] != first["items"][0]["id"]


def test_total_is_the_full_count_not_the_page(client: TestClient) -> None:
    assert _get(client, [("limit", "2")])["total"] == TOTAL_SEEDED


def test_tampered_cursor_is_rejected(client: TestClient) -> None:
    response = client.get(URL, params=[("cursor", "not-a-real-cursor")])
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_cursor"


def test_cursor_of_an_unknown_kind_is_rejected(client: TestClient) -> None:
    """Un cursor que no salió de este listado se rechaza, no se reinterpreta."""
    response = client.get(URL, params=[("cursor", encode_cursor("otro-listado", page=2))])
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_cursor"


def test_detection_without_subtechnique_falls_back_to_technique(client: TestClient) -> None:
    body = _get(client, [("filter[event_id]", "4688")])
    technique = body["items"][0]["techniques"][0]
    assert technique["technique_id"] == "T1059"
    assert technique["id"] == "T1059"
    assert technique["name"] == technique["technique_name"]


def test_detection_with_subtechnique_exposes_leaf(client: TestClient) -> None:
    body = _get(client, [("filter[subtechnique]", "T1059.001")])
    technique = body["items"][0]["techniques"][0]
    assert technique["technique_id"] == "T1059"
    assert technique["id"] == "T1059.001"
    assert technique["name"] == "PowerShell"
