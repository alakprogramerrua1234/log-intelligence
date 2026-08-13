"""Semántica del catálogo de filtros: parseo, validación y consistencia.

Este módulo no construye ni ejecuta SQL. Trabaja sobre claves de categoría y
delega en `repositories.bindings` cuando hace falta bajar a columnas.

Ver ARCHITECTURE.md §2 (decisión #3) para el reparto DB / código.
"""

from collections.abc import Iterable, Mapping, Sequence
from typing import Protocol

from src.models import FilterCategory
from src.repositories import FILTERABLE, FilterCategoryRepository, SuggestRecord

_FILTER_PREFIX = "filter["
_FILTER_SUFFIX = "]"

DEFAULT_VALUES_LIMIT = 200
DEFAULT_SUGGEST_PER_CATEGORY = 4


class UnknownFilterCategoryError(Exception):
    """Se pidió filtrar por una categoría que no existe o está deshabilitada."""

    def __init__(self, keys: Sequence[str]) -> None:
        self.keys = list(keys)
        super().__init__(f"Unknown filter categories: {', '.join(self.keys)}")


class FilterCatalogError(RuntimeError):
    """`filter_category` (DB) y `FILTERABLE` (código) no concuerdan."""


class CategorySpec(Protocol):
    """Lo que `validate_catalog` necesita de una fila de `filter_category`."""

    key: str
    source_table: str
    value_column: str
    detection_fk: str


def parse_filters(params: Iterable[tuple[str, str]]) -> dict[str, list[str]]:
    """Extrae `filter[<key>]=<value>` del query string, sin enumerar claves.

    Multi-valor por repetición del parámetro. Las claves no se validan aquí:
    de eso se encarga `validate_filters` contra el catálogo.
    """
    filters: dict[str, list[str]] = {}
    for raw_key, value in params:
        if not raw_key.startswith(_FILTER_PREFIX) or not raw_key.endswith(_FILTER_SUFFIX):
            continue
        key = raw_key[len(_FILTER_PREFIX) : -len(_FILTER_SUFFIX)]
        if not key or not value:
            continue
        filters.setdefault(key, []).append(value)
    return filters


def validate_filters(filters: Mapping[str, Sequence[str]], enabled_keys: Iterable[str]) -> None:
    """Falla con 400 en vez de ignorar en silencio una categoría desconocida.

    Ignorarla devolvería 200 con la tabla sin filtrar, que es el peor modo de
    fallo posible: un analista comparte una URL y el receptor cree estar viendo
    resultados filtrados.
    """
    unknown = sorted(set(filters) - set(enabled_keys))
    if unknown:
        raise UnknownFilterCategoryError(unknown)


def validate_catalog(categories: Iterable[CategorySpec]) -> None:
    """Cruza el catálogo de la DB con el registro de código. Se llama al arrancar.

    Sin esto, habilitar una categoría en `filter_category` sin su binding se
    manifestaría en producción como resultados sin filtrar. Con esto, la app
    no arranca.
    """
    problems: list[str] = []
    for category in categories:
        binding = FILTERABLE.get(category.key)
        if binding is None:
            problems.append(
                f"'{category.key}': habilitada en filter_category pero sin binding en FILTERABLE"
            )
            continue
        if category.source_table != binding.source_table:
            problems.append(
                f"'{category.key}': source_table='{category.source_table}' en la DB "
                f"pero el binding apunta a '{binding.source_table}'"
            )
        if category.value_column != binding.value_column_name:
            problems.append(
                f"'{category.key}': value_column='{category.value_column}' en la DB "
                f"pero el binding usa '{binding.value_column_name}'"
            )
        if category.detection_fk != binding.detection_fk_name:
            problems.append(
                f"'{category.key}': detection_fk='{category.detection_fk}' en la DB "
                f"pero el binding usa '{binding.detection_fk_name}'"
            )

    if problems:
        raise FilterCatalogError(
            "Catálogo de filtros inconsistente:\n  - " + "\n  - ".join(problems)
        )


class FilterService:
    """Sirve el catálogo y los valores de cada categoría."""

    def __init__(self, catalog: FilterCategoryRepository) -> None:
        self._catalog = catalog

    def list_categories(self) -> list[FilterCategory]:
        return self._catalog.list_enabled()

    def enabled_keys(self) -> list[str]:
        return [category.key for category in self._catalog.list_enabled()]

    def values(self, key: str, q: str, limit: int = DEFAULT_VALUES_LIMIT) -> list[str]:
        if key not in self.enabled_keys():
            raise UnknownFilterCategoryError([key])
        return self._catalog.distinct_values(key, q, limit)

    def suggest(
        self, q: str, per_category: int = DEFAULT_SUGGEST_PER_CATEGORY
    ) -> list[SuggestRecord]:
        categories = [(c.key, c.label) for c in self._catalog.list_enabled()]
        return self._catalog.suggest(categories, q, per_category)
