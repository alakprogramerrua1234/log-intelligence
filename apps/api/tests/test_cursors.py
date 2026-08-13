"""Cursores opacos: round-trip y rechazo de todo lo demás."""

import base64
import json

import pytest

from src.search.cursors import InvalidCursorError, decode_cursor, encode_cursor


def test_round_trip() -> None:
    assert decode_cursor(encode_cursor("id", 42), "id") == 42


def test_round_trip_at_zero() -> None:
    assert decode_cursor(encode_cursor("offset", 0), "offset") == 0


def test_cursor_is_opaque() -> None:
    """No debe parecer un id: si parece, alguien acabará construyéndolo a mano."""
    assert encode_cursor("id", 42) != "42"


def test_cursor_has_no_padding() -> None:
    """El `=` de base64 se escapa mal en URLs; se quita al codificar."""
    assert "=" not in encode_cursor("id", 1)


def test_rejects_cursor_from_another_backend() -> None:
    """Un cursor de Postgres no vale tras cambiar a Meilisearch, y viceversa."""
    with pytest.raises(InvalidCursorError):
        decode_cursor(encode_cursor("id", 10), "page")


@pytest.mark.parametrize(
    "cursor",
    ["", "not-base64!!", "Zm9v", "eyJrIjoiaWQifQ", "e30"],
    ids=["empty", "invalid-b64", "not-json", "missing-value", "empty-object"],
)
def test_rejects_malformed_cursors(cursor: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(cursor, "id")


def _forge(payload: object) -> str:
    raw = json.dumps(payload).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


@pytest.mark.parametrize(
    "payload",
    [
        {"k": "id", "v": -1},
        {"k": "id", "v": "42"},
        {"k": "id", "v": 1.5},
        {"k": "id", "v": True},
        {"k": "id", "v": None},
        ["id", 42],
        "id:42",
    ],
    ids=["negative", "string", "float", "bool", "null", "list", "scalar"],
)
def test_rejects_forged_payloads(payload: object) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(_forge(payload), "id")


def test_error_carries_the_offending_cursor() -> None:
    with pytest.raises(InvalidCursorError) as exc:
        decode_cursor("garbage", "id")
    assert exc.value.cursor == "garbage"
