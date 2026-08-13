"""Endpoints de descubrimiento: `/filters/categories`, `/values` y `/suggest`."""

from fastapi.testclient import TestClient

from src.ingest.load import FILTER_CATEGORIES


def test_categories_come_from_the_catalog_in_order(client: TestClient) -> None:
    response = client.get("/api/v1/filters/categories")
    assert response.status_code == 200
    body = response.json()
    assert [c["key"] for c in body] == [row["key"] for row in FILTER_CATEGORIES]
    assert [c["order"] for c in body] == sorted(c["order"] for c in body)


def test_values_returns_distinct_sorted_values(client: TestClient) -> None:
    response = client.get("/api/v1/filters/values", params={"category": "platform"})
    assert response.status_code == 200
    assert response.json() == ["AWS", "Linux", "Windows"]


def test_values_uses_the_id_for_techniques(client: TestClient) -> None:
    """El valor que viaja es el ID de ATT&CK, aunque la UI muestre el nombre."""
    response = client.get("/api/v1/filters/values", params={"category": "technique"})
    assert response.json() == ["T1053", "T1059", "T1078"]


def test_values_filters_by_query(client: TestClient) -> None:
    response = client.get(
        "/api/v1/filters/values", params={"category": "platform", "q": "win"}
    )
    assert response.json() == ["Windows"]


def test_values_rejects_unknown_category(client: TestClient) -> None:
    response = client.get("/api/v1/filters/values", params={"category": "nope"})
    assert response.status_code == 404


def test_values_respects_limit(client: TestClient) -> None:
    response = client.get(
        "/api/v1/filters/values", params={"category": "platform", "limit": 2}
    )
    assert len(response.json()) == 2


def test_suggest_matches_across_categories(client: TestClient) -> None:
    response = client.get("/api/v1/filters/suggest", params={"q": "win"})
    assert response.status_code == 200
    by_category = {item["category"] for item in response.json()}
    assert "platform" in by_category        # "Windows"
    assert "log_source" in by_category      # "Windows Security"
    assert "subtechnique" in by_category    # "Windows Command Shell"


def test_suggest_labels_come_from_the_catalog(client: TestClient) -> None:
    """Las etiquetas salen de `filter_category`, no de literales en el código."""
    labels = {row["key"]: row["label"] for row in FILTER_CATEGORIES}
    response = client.get("/api/v1/filters/suggest", params={"q": "win"})
    for item in response.json():
        assert item["label"] == labels[item["category"]]


def test_suggest_separates_display_from_value_for_techniques(client: TestClient) -> None:
    response = client.get("/api/v1/filters/suggest", params={"q": "powershell"})
    items = [item for item in response.json() if item["category"] == "subtechnique"]
    assert items == [
        {
            "display": "PowerShell",
            "value": "T1059.001",
            "category": "subtechnique",
            "label": labels_for("subtechnique"),
        }
    ]


def test_suggest_finds_techniques_by_attack_id(client: TestClient) -> None:
    response = client.get("/api/v1/filters/suggest", params={"q": "T1053"})
    values = {item["value"] for item in response.json()}
    assert "T1053" in values


def test_suggest_requires_a_query(client: TestClient) -> None:
    assert client.get("/api/v1/filters/suggest", params={"q": ""}).status_code == 422


def test_suggest_caps_results_per_category(client: TestClient) -> None:
    response = client.get(
        "/api/v1/filters/suggest", params={"q": "T10", "per_category": 1}
    )
    counts: dict[str, int] = {}
    for item in response.json():
        counts[item["category"]] = counts.get(item["category"], 0) + 1
    assert all(count <= 1 for count in counts.values())


def labels_for(key: str) -> str:
    return next(row["label"] for row in FILTER_CATEGORIES if row["key"] == key)
