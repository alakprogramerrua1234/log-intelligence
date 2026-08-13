"""Backend e indexador de Meilisearch, contra un cliente doble en proceso.

No hay un Meilisearch levantado en CI, así que lo que se verifica aquí es todo
lo que es nuestro: la expresión de filtro, la traducción de cursores a páginas,
la forma del documento y los atributos derivados del catálogo. Lo que queda sin
verificar es el contrato de red con Meilisearch — eso pide una suite de
integración contra el contenedor de docker-compose.
"""

from collections.abc import Iterable, Mapping, Sequence
from typing import Any

import pytest

from src.ingest.load import FILTER_CATEGORIES
from src.models import FilterCategory
from src.repositories import DetectionRecord
from src.search.client import SearchResult
from src.search.cursors import InvalidCursorError, encode_cursor
from src.search.indexer import (
    build_document,
    filterable_attributes,
    reindex,
    searchable_attributes,
)
from src.search.meili import MeilisearchBackend, build_filter


class FakeMeiliClient:
    """Doble en proceso: registra las llamadas y devuelve lo que se le programe."""

    def __init__(self, result: SearchResult | None = None) -> None:
        self.result = result or SearchResult(ids=[], total_hits=0, total_pages=0)
        self.searches: list[dict[str, Any]] = []
        self.settings: list[dict[str, Any]] = []
        self.batches: list[list[Mapping[str, Any]]] = []
        self.indexes: list[tuple[str, str]] = []

    def search(
        self, index: str, q: str, filter_expression: str, page: int, hits_per_page: int
    ) -> SearchResult:
        self.searches.append(
            {
                "index": index,
                "q": q,
                "filter": filter_expression,
                "page": page,
                "hits_per_page": hits_per_page,
            }
        )
        return self.result

    def ensure_index(self, index: str, primary_key: str) -> None:
        self.indexes.append((index, primary_key))

    def update_settings(
        self, index: str, filterable: Sequence[str], searchable: Sequence[str]
    ) -> None:
        self.settings.append({"filterable": list(filterable), "searchable": list(searchable)})

    def replace_documents(self, index: str, documents: Iterable[Mapping[str, Any]]) -> int:
        batch = list(documents)
        self.batches.append(batch)
        return len(batch)


def _record(detection_id: int, subtechnique: bool = True) -> DetectionRecord:
    return DetectionRecord(
        id=detection_id,
        platform="Windows",
        log_source_id=1,
        log_source_name="Sysmon",
        event_id="1",
        tactic="execution",
        technique_id="T1059",
        technique_name="Command and Scripting Interpreter",
        subtechnique_id="T1059.001" if subtechnique else None,
        subtechnique_name="PowerShell" if subtechnique else None,
    )


CATEGORIES = [FilterCategory(**row) for row in FILTER_CATEGORIES]
KEYS = [row["key"] for row in FILTER_CATEGORIES]


# ── expresión de filtro ───────────────────────────────────────────────────────


def test_build_filter_is_empty_without_filters() -> None:
    assert build_filter({}) == ""


def test_build_filter_uses_in_for_multiple_values() -> None:
    assert build_filter({"platform": ["Windows", "Linux"]}) == 'platform IN ["Windows","Linux"]'


def test_build_filter_joins_categories_with_and() -> None:
    expression = build_filter({"tactic": ["execution"], "platform": ["Windows"]})
    assert expression == 'platform IN ["Windows"] AND tactic IN ["execution"]'


def test_build_filter_is_deterministic() -> None:
    """Mismo filtro, misma expresión: si no, la caché de Meilisearch no sirve."""
    filters = {"tactic": ["execution"], "platform": ["Windows"]}
    assert build_filter(filters) == build_filter(dict(reversed(list(filters.items()))))


def test_build_filter_skips_empty_value_lists() -> None:
    assert build_filter({"platform": [], "tactic": ["execution"]}) == 'tactic IN ["execution"]'


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ('say "hi"', r'"say \"hi\""'),
        ("back\\slash", r'"back\\slash"'),
        ("plain", '"plain"'),
    ],
)
def test_filter_values_are_escaped(value: str, expected: str) -> None:
    """Los valores vienen del usuario; no pueden romper la expresión."""
    assert build_filter({"platform": [value]}) == f"platform IN [{expected}]"


# ── paginación ────────────────────────────────────────────────────────────────


def test_first_page_starts_at_one() -> None:
    client = FakeMeiliClient(SearchResult(ids=[1], total_hits=1, total_pages=1))
    MeilisearchBackend(client).search("x", {}, limit=10, cursor=None)
    assert client.searches[0]["page"] == 1


def test_next_cursor_advances_one_page() -> None:
    client = FakeMeiliClient(SearchResult(ids=[1, 2], total_hits=6, total_pages=3))
    page = MeilisearchBackend(client).search("x", {}, limit=2, cursor=None)

    assert page.total == 6
    assert page.next_cursor is not None

    MeilisearchBackend(client).search("x", {}, limit=2, cursor=page.next_cursor)
    assert client.searches[1]["page"] == 2


def test_last_page_has_no_next_cursor() -> None:
    client = FakeMeiliClient(SearchResult(ids=[5], total_hits=5, total_pages=3))
    cursor = encode_cursor("page", 3)
    assert MeilisearchBackend(client).search("x", {}, 2, cursor).next_cursor is None


def test_empty_result_has_no_next_cursor() -> None:
    client = FakeMeiliClient(SearchResult(ids=[], total_hits=0, total_pages=0))
    page = MeilisearchBackend(client).search("nada", {}, 10, None)
    assert page.ids == []
    assert page.next_cursor is None


def test_rejects_a_postgres_cursor() -> None:
    client = FakeMeiliClient()
    with pytest.raises(InvalidCursorError):
        MeilisearchBackend(client).search("x", {}, 10, encode_cursor("id", 7))


def test_rejects_a_forged_page_zero() -> None:
    client = FakeMeiliClient()
    with pytest.raises(InvalidCursorError):
        MeilisearchBackend(client).search("x", {}, 10, encode_cursor("page", 0))


def test_limit_becomes_hits_per_page() -> None:
    client = FakeMeiliClient(SearchResult(ids=[], total_hits=0, total_pages=0))
    MeilisearchBackend(client).search("x", {}, limit=37, cursor=None)
    assert client.searches[0]["hits_per_page"] == 37


# ── documentos e índice ───────────────────────────────────────────────────────


def test_document_uses_filter_values_as_attribute_values() -> None:
    document = build_document(_record(7), KEYS)
    assert document["id"] == 7
    assert document["platform"] == "Windows"
    assert document["technique"] == "T1059"          # el ID, no el nombre
    assert document["subtechnique"] == "T1059.001"


def test_document_adds_readable_name_only_when_it_differs() -> None:
    document = build_document(_record(7), KEYS)
    assert document["technique_name"] == "Command and Scripting Interpreter"
    assert "platform_name" not in document           # display == value


def test_document_keeps_null_subtechnique() -> None:
    document = build_document(_record(7, subtechnique=False), KEYS)
    assert document["subtechnique"] is None


def test_filterable_attributes_are_the_catalog_keys() -> None:
    assert filterable_attributes(KEYS) == KEYS


def test_searchable_attributes_follow_catalog_order() -> None:
    """El orden es el ranking en Meilisearch, y sale de `filter_category.order`."""
    assert searchable_attributes(KEYS) == [
        "platform",
        "log_source",
        "event_id",
        "tactic",
        "technique",
        "technique_name",
        "subtechnique",
        "subtechnique_name",
    ]


def test_reindex_creates_index_and_pushes_settings() -> None:
    client = FakeMeiliClient()
    report = reindex(client, "detections", CATEGORIES, [_record(1), _record(2)])

    assert client.indexes == [("detections", "id")]
    assert client.settings[0]["filterable"] == KEYS
    assert report.documents == 2


def test_reindex_batches_documents() -> None:
    client = FakeMeiliClient()
    records = [_record(i) for i in range(1, 8)]
    report = reindex(client, "detections", CATEGORIES, records, batch_size=3)

    assert [len(batch) for batch in client.batches] == [3, 3, 1]
    assert report.documents == 7


def test_reindex_on_empty_dataset_still_configures_the_index() -> None:
    client = FakeMeiliClient()
    report = reindex(client, "detections", CATEGORIES, [])

    assert report.documents == 0
    assert client.settings, "los ajustes deben aplicarse aunque no haya documentos"


def test_reindex_only_indexes_enabled_categories() -> None:
    client = FakeMeiliClient()
    enabled = [c for c in CATEGORIES if c.key != "event_id"]
    reindex(client, "detections", enabled, [_record(1)])

    assert "event_id" not in client.settings[0]["filterable"]
    assert "event_id" not in client.batches[0][0]
