"""Lógica de dominio. Orquesta repositories; no abre sesiones ni ejecuta SQL."""

from .detections import DetectionService
from .filters import (
    FilterCatalogError,
    FilterService,
    UnknownFilterCategoryError,
    UnknownSortKeyError,
    parse_filters,
    parse_sort,
    validate_catalog,
    validate_filters,
)

__all__ = [
    "DetectionService",
    "FilterCatalogError",
    "FilterService",
    "UnknownFilterCategoryError",
    "UnknownSortKeyError",
    "parse_filters",
    "parse_sort",
    "validate_catalog",
    "validate_filters",
]
