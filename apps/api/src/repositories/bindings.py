"""Cómo se traduce cada categoría de filtro a SQL.

Este módulo es la mitad "código" del sistema de filtros dinámicos
(ver ARCHITECTURE.md §2, decisión #3). El reparto es deliberado:

  - `filter_category` (DB)  → QUÉ existe y cómo se presenta: label, order,
                              ui_hint, enabled. Cambiarlo NO requiere deploy.
  - `FILTERABLE` (aquí)     → CÓMO se traduce a SQL: columnas tipadas de
                              SQLAlchemy, nunca strings de la DB.

Nunca se construye SQL a partir de datos de `filter_category`: las filas solo
pueden *seleccionar* dentro de este registro. `services.filters.validate_catalog`
cruza ambos al arrancar para que una inconsistencia sea un fallo de boot.

Añadir una dimensión nueva = migración + modelo + una línea aquí.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, func, or_
from sqlalchemy.orm import InstrumentedAttribute

from src.models import Detection, EventId, LogSource, Platform, Subtechnique, Tactic, Technique
from src.models.base import Base


@dataclass(frozen=True)
class FilterBinding:
    """Une una `filter_category.key` con las columnas reales que la implementan."""

    key: str
    model: type[Base]
    #: Columna cuyo contenido viaja por la red como valor de filtro.
    value_column: InstrumentedAttribute[Any]
    #: Columna legible que se muestra al usuario. Coincide con `value_column`
    #: en las dimensiones; difiere en technique/subtechnique (valor = ID ATT&CK,
    #: display = nombre).
    display_column: InstrumentedAttribute[Any]
    #: FK en `detection` por la que se filtra.
    detection_fk: InstrumentedAttribute[Any]
    #: Campo de `DetectionRecord` del que sale el valor al indexar.
    record_value_field: str
    #: Campo de `DetectionRecord` del que sale el texto legible al indexar.
    record_display_field: str

    @property
    def source_table(self) -> str:
        return str(self.model.__tablename__)

    @property
    def value_column_name(self) -> str:
        return self.value_column.key

    @property
    def detection_fk_name(self) -> str:
        return self.detection_fk.key


FILTERABLE: Mapping[str, FilterBinding] = {
    binding.key: binding
    for binding in (
        FilterBinding(
            "platform", Platform, Platform.name, Platform.name, Detection.platform_id,
            "platform", "platform",
        ),
        FilterBinding(
            "log_source", LogSource, LogSource.name, LogSource.name, Detection.log_source_id,
            "log_source_name", "log_source_name",
        ),
        FilterBinding(
            "event_id", EventId, EventId.name, EventId.name, Detection.event_id_id,
            "event_id", "event_id",
        ),
        FilterBinding(
            "tactic", Tactic, Tactic.name, Tactic.name, Detection.tactic_id,
            "tactic", "tactic",
        ),
        FilterBinding(
            "technique", Technique, Technique.id, Technique.name, Detection.technique_id,
            "technique_id", "technique_name",
        ),
        FilterBinding(
            "subtechnique", Subtechnique, Subtechnique.id, Subtechnique.name,
            Detection.subtechnique_id, "subtechnique_id", "subtechnique_name",
        ),
    )
}


def search_columns() -> list[InstrumentedAttribute[Any]]:
    """Columnas que cubre la búsqueda libre `q`: todo lo filtrable, sin duplicar.

    Se deriva del registro en vez de mantener una lista aparte, para que una
    categoría nueva sea buscable sin tocar la query.
    """
    seen: set[tuple[str, str]] = set()
    columns: list[InstrumentedAttribute[Any]] = []
    for binding in FILTERABLE.values():
        for column in (binding.display_column, binding.value_column):
            identity = (binding.source_table, column.key)
            if identity not in seen:
                seen.add(identity)
                columns.append(column)
    return columns


def search_predicate(q: str) -> ColumnElement[bool]:
    """`q` hace match parcial, case-insensitive, contra cualquier columna filtrable."""
    term = f"%{q.lower()}%"
    return or_(*(func.lower(column).like(term) for column in search_columns()))


def apply_filters(
    stmt: Select[Any], filters: Mapping[str, Sequence[str]]
) -> Select[Any]:
    """Aplica filtros ya validados. OR dentro de una categoría, AND entre categorías.

    Asume que cada clave existe en `FILTERABLE`; validarlo es responsabilidad de
    `services.filters.validate_filters`, que corre antes.
    """
    for key, values in filters.items():
        column = FILTERABLE[key].value_column
        stmt = stmt.where(func.lower(column).in_([value.lower() for value in values]))
    return stmt
