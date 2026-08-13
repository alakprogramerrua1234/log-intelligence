"""Cursores opacos para paginación.

Son opacos a propósito: el cliente no puede depender de su contenido, así que
cada backend de búsqueda elige su propia estrategia sin romper el contrato.
Postgres pagina por keyset sobre `detection.id`; Meilisearch por offset, porque
su orden es por relevancia y no hay clave estable sobre la que hacer keyset.
Ambos caben detrás del mismo `next_cursor`.

Offset duele en datasets grandes, y por eso el camino por defecto (Postgres) usa
keyset. Con Meilisearch el offset lo resuelve el motor de búsqueda, no un
`OFFSET` de SQL.
"""

import base64
import binascii
import json


class InvalidCursorError(Exception):
    """El cursor no se puede decodificar o no corresponde a este backend."""

    def __init__(self, cursor: str) -> None:
        self.cursor = cursor
        super().__init__("Invalid or expired cursor")


def encode_cursor(kind: str, value: int) -> str:
    raw = json.dumps({"k": kind, "v": value}, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: str, expected_kind: str) -> int:
    """Devuelve el valor del cursor, o lanza si no es válido para `expected_kind`.

    Un cursor de otro backend (p. ej. guardado antes de cambiar a Meilisearch)
    se rechaza explícitamente en vez de interpretarse mal.
    """
    padding = "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(cursor + padding)
        payload = json.loads(raw)
    except (ValueError, binascii.Error) as exc:
        raise InvalidCursorError(cursor) from exc

    if not isinstance(payload, dict):
        raise InvalidCursorError(cursor)
    if payload.get("k") != expected_kind:
        raise InvalidCursorError(cursor)

    value = payload.get("v")
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise InvalidCursorError(cursor)
    return value
