"""Capa de persistencia: único sitio del backend que abre una `Session` y ejecuta SQL.

Los services orquestan; los routers hablan HTTP. Ninguno de los dos importa
`Session` ni ejecuta queries — `tests/test_layering.py` lo verifica.
"""

from .bindings import FILTERABLE, SORTABLE, FilterBinding, SortBinding, SortSpec
from .detection import DetectionRecord, DetectionRepository, MatchRow
from .filter_category import FilterCategoryRepository, SuggestRecord

__all__ = [
    "FILTERABLE",
    "SORTABLE",
    "DetectionRecord",
    "DetectionRepository",
    "FilterBinding",
    "FilterCategoryRepository",
    "MatchRow",
    "SortBinding",
    "SortSpec",
    "SuggestRecord",
]
