"""Búsqueda: contrato, backend y cursores.

Ningún módulo de aquí ejecuta SQL — el backend de Postgres compone
`DetectionRepository`. La frontera de persistencia sigue siendo `repositories/`.
"""

from .backend import SearchBackend, SearchPage
from .cursors import InvalidCursorError, decode_cursor, encode_cursor
from .postgres import PostgresSearchBackend

__all__ = [
    "InvalidCursorError",
    "PostgresSearchBackend",
    "SearchBackend",
    "SearchPage",
    "decode_cursor",
    "encode_cursor",
]
