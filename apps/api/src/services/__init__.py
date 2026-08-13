"""Lógica de dominio. Orquesta repositories; no abre sesiones ni ejecuta SQL."""

from .detections import DetectionService
from .filters import (
    FilterCatalogError,
    FilterService,
    UnknownFilterCategoryError,
    parse_filters,
    validate_catalog,
    validate_filters,
)

__all__ = [
    "DetectionService",
    "FilterCatalogError",
    "FilterService",
    "UnknownFilterCategoryError",
    "parse_filters",
    "validate_catalog",
    "validate_filters",
]
