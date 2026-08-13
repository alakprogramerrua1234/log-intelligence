"""Cursores opacos: round-trip y rechazo de todo lo demás."""

import base64
import json
from typing import Any

import pytest

from src.repositories import SortSpec
from src.search.cursors import (
    InvalidCursorError,
    cursor_int,
    cursor_str,
    decode_cursor,
    encode_cursor,
)


def test_round_trip() -> None:
    assert decode_cursor(encode_cursor("id", id=42), "id") == {"id": 42}


def test_round_trip_carries_several_fields() -> None:
    """El keyset compuesto necesita id + valor de la columna de orden."""
    cursor = encode_cursor("sort:tactic:asc", id=7, v="execution")
    assert decode_cursor(cursor, "sort:tactic:asc") == {"id": 7, "v": "execution"}


def test_cursor_is_opaque() -> None:
    """No debe parecer un id: si lo parece, alguien acabará construyéndolo a mano."""
    assert encode_cursor("id", id=42) != "42"
    assert "42" not in encode_cursor("id", id=42)


def test_cursor_has_no_padding() -> None:
    """El `=` de base64 se escapa mal en URLs; se quita al codificar."""
    assert "=" not in encode_cursor("id", id=1)


def test_encoding_is_deterministic() -> None:
    assert encode_cursor("id", id=1, v="a") == encode_cursor("id", v="a", id=1)


# ── el `kind` protege de mezclar listados ─────────────────────────────────────


def test_rejects_cursor_from_another_backend() -> None:
    """Un cursor de Postgres no vale tras cambiar a Meilisearch, y viceversa."""
    with pytest.raises(InvalidCursorError):
        decode_cursor(encode_cursor("id", id=10), "page")


def test_rejects_cursor_from_a_different_sort() -> None:
    """Cambiar de orden invalida el cursor: seguir paginando saltaría filas."""
    cursor = encode_cursor(SortSpec("tactic", descending=False).cursor_kind, id=1, v="a")
    with pytest.raises(InvalidCursorError):
        decode_cursor(cursor, SortSpec("tactic", descending=True).cursor_kind)


def test_sort_spec_cursor_kind_encodes_key_and_direction() -> None:
    assert SortSpec("event_id", descending=False).cursor_kind == "sort:event_id:asc"
    assert SortSpec("event_id", descending=True).cursor_kind == "sort:event_id:desc"


# ── entradas malformadas ──────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "cursor",
    ["", "not-base64!!", "Zm9v", "e30", "eyJrIjoiaWQifQ"],
    ids=["empty", "invalid-b64", "not-json", "empty-object", "only-kind"],
)
def test_rejects_malformed_cursors(cursor: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(cursor, "id")


def _forge(payload: object) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")


@pytest.mark.parametrize("payload", [["id", 42], "id:42", 42], ids=["list", "scalar", "number"])
def test_rejects_non_object_payloads(payload: object) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(_forge(payload), "id")


def test_error_carries_the_offending_cursor() -> None:
    with pytest.raises(InvalidCursorError) as exc:
        decode_cursor("garbage", "id")
    assert exc.value.cursor == "garbage"


# ── lectura tipada de campos ──────────────────────────────────────────────────


def test_cursor_int_reads_a_valid_id() -> None:
    assert cursor_int({"id": 5}, "id", "c") == 5


@pytest.mark.parametrize(
    "value",
    [-1, "42", 1.5, True, None],
    ids=["negative", "string", "float", "bool", "missing"],
)
def test_cursor_int_rejects_anything_else(value: Any) -> None:
    with pytest.raises(InvalidCursorError):
        cursor_int({"id": value}, "id", "c")


def test_cursor_str_allows_null_for_a_nullable_column() -> None:
    assert cursor_str({"v": None}, "v", "c") is None
    assert cursor_str({"v": "Sysmon"}, "v", "c") == "Sysmon"


def test_cursor_str_rejects_non_strings() -> None:
    with pytest.raises(InvalidCursorError):
        cursor_str({"v": 3}, "v", "c")
