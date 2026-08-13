"""Tests puros del catálogo de filtros: sin DB, sin FastAPI."""

from dataclasses import dataclass, fields

import pytest

from src.ingest.load import FILTER_CATEGORIES
from src.repositories import FILTERABLE, DetectionRecord
from src.services.filters import (
    FilterCatalogError,
    UnknownFilterCategoryError,
    parse_filters,
    validate_catalog,
    validate_filters,
)


@dataclass
class FakeCategory:
    key: str
    source_table: str
    value_column: str
    detection_fk: str


def _category(key: str, **overrides: str) -> FakeCategory:
    binding = FILTERABLE[key]
    fields = {
        "key": key,
        "source_table": binding.source_table,
        "value_column": binding.value_column_name,
        "detection_fk": binding.detection_fk_name,
    }
    return FakeCategory(**{**fields, **overrides})


# ── parse_filters ─────────────────────────────────────────────────────────────


def test_parse_filters_extracts_bracketed_keys() -> None:
    assert parse_filters([("filter[platform]", "Windows")]) == {"platform": ["Windows"]}


def test_parse_filters_groups_repeated_keys_as_multivalue() -> None:
    params = [("filter[tactic]", "execution"), ("filter[tactic]", "persistence")]
    assert parse_filters(params) == {"tactic": ["execution", "persistence"]}


def test_parse_filters_ignores_non_filter_params() -> None:
    params = [("q", "process"), ("limit", "50"), ("filter[platform]", "Linux")]
    assert parse_filters(params) == {"platform": ["Linux"]}


@pytest.mark.parametrize(
    "raw_key",
    ["filter", "filter[", "filter]", "filterplatform", "f.platform", "filter[]"],
)
def test_parse_filters_ignores_malformed_keys(raw_key: str) -> None:
    assert parse_filters([(raw_key, "Windows")]) == {}


def test_parse_filters_ignores_empty_values() -> None:
    assert parse_filters([("filter[platform]", "")]) == {}


def test_parse_filters_accepts_unknown_keys() -> None:
    """Parsear no valida: eso es trabajo de validate_filters, con el catálogo."""
    assert parse_filters([("filter[nope]", "x")]) == {"nope": ["x"]}


# ── validate_filters ──────────────────────────────────────────────────────────


def test_validate_filters_accepts_enabled_keys() -> None:
    validate_filters({"platform": ["Windows"]}, ["platform", "tactic"])


def test_validate_filters_rejects_unknown_key() -> None:
    with pytest.raises(UnknownFilterCategoryError) as exc:
        validate_filters({"nope": ["x"]}, ["platform"])
    assert exc.value.keys == ["nope"]


def test_validate_filters_reports_every_unknown_key_sorted() -> None:
    with pytest.raises(UnknownFilterCategoryError) as exc:
        validate_filters({"zeta": ["x"], "alpha": ["y"], "platform": ["Windows"]}, ["platform"])
    assert exc.value.keys == ["alpha", "zeta"]


def test_validate_filters_rejects_disabled_category() -> None:
    """Una categoría deshabilitada no es filtrable aunque exista el binding."""
    with pytest.raises(UnknownFilterCategoryError):
        validate_filters({"tactic": ["execution"]}, ["platform"])


# ── validate_catalog ──────────────────────────────────────────────────────────


def test_seed_matches_code_registry() -> None:
    """El seed real de `filter_category` concuerda con FILTERABLE.

    Es el test que detecta la deriva entre DB y código en CI, antes de que la
    detecte el arranque en producción.
    """
    validate_catalog([_category(row["key"]) for row in FILTER_CATEGORIES])


def test_validate_catalog_rejects_category_without_binding() -> None:
    orphan = FakeCategory(
        key="data_source",
        source_table="data_source",
        value_column="name",
        detection_fk="data_source_id",
    )
    with pytest.raises(FilterCatalogError, match="sin binding"):
        validate_catalog([orphan])


@pytest.mark.parametrize(
    ("field", "bad_value", "expected"),
    [
        ("source_table", "wrong_table", "source_table"),
        ("value_column", "wrong_column", "value_column"),
        ("detection_fk", "wrong_fk", "detection_fk"),
    ],
)
def test_validate_catalog_rejects_mismatched_binding(
    field: str, bad_value: str, expected: str
) -> None:
    with pytest.raises(FilterCatalogError, match=expected):
        validate_catalog([_category("platform", **{field: bad_value})])


def test_bindings_reference_real_detection_record_fields() -> None:
    """`record_value_field` / `record_display_field` alimentan el indexador.

    Si un binding apunta a un campo que no existe, el fallo saldría al reindexar
    (fuera de la request, fácil de no ver). Aquí sale en CI.
    """
    available = {f.name for f in fields(DetectionRecord)}
    for key, binding in FILTERABLE.items():
        assert binding.record_value_field in available, key
        assert binding.record_display_field in available, key


def test_every_seeded_category_has_a_binding() -> None:
    assert {row["key"] for row in FILTER_CATEGORIES} == set(FILTERABLE)


def test_validate_catalog_reports_all_problems_at_once() -> None:
    with pytest.raises(FilterCatalogError) as exc:
        validate_catalog(
            [
                _category("platform", source_table="wrong"),
                FakeCategory("ghost", "ghost", "name", "ghost_id"),
            ]
        )
    message = str(exc.value)
    assert "platform" in message
    assert "ghost" in message
