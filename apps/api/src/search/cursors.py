"""Cursores opacos para paginación.

Son opacos a propósito: el cliente no puede depender de su contenido, así que el
backend puede cambiar de estrategia sin romper el contrato. Postgres pagina por
keyset sobre `id`, o sobre `(columna, id)` cuando hay ordenación.

El `kind` identifica **de qué listado salió el cursor**. Si cambias la
ordenación, el `kind` cambia y el cursor viejo se rechaza en vez de producir una
página incoherente — saltos o filas repetidas que nadie detectaría a simple vista.
"""

import base64
import binascii
import json
from typing import Any

CursorFields = dict[str, Any]


class InvalidCursorError(Exception):
    """El cursor no se puede decodificar, o no corresponde a este listado."""

    def __init__(self, cursor: str) -> None:
        self.cursor = cursor
        super().__init__("Invalid or expired cursor")


def encode_cursor(kind: str, **fields: Any) -> str:
    payload: dict[str, Any] = {"k": kind, **fields}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: str, expected_kind: str) -> CursorFields:
    """Devuelve los campos del cursor, o lanza si no es válido para `expected_kind`."""
    padding = "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(cursor + padding)
        payload = json.loads(raw)
    except (ValueError, binascii.Error) as exc:
        raise InvalidCursorError(cursor) from exc

    if not isinstance(payload, dict) or payload.get("k") != expected_kind:
        raise InvalidCursorError(cursor)

    fields = {key: value for key, value in payload.items() if key != "k"}
    if not fields:
        raise InvalidCursorError(cursor)
    return fields


def cursor_int(fields: CursorFields, name: str, cursor: str) -> int:
    """Lee un entero no negativo del cursor. `bool` no cuela: en Python es un int."""
    value = fields.get(name)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise InvalidCursorError(cursor)
    return value


def cursor_str(fields: CursorFields, name: str, cursor: str) -> str | None:
    """Lee un valor de ordenación. `None` es legítimo: la columna puede ser NULL."""
    value = fields.get(name)
    if value is None or isinstance(value, str):
        return value
    raise InvalidCursorError(cursor)
