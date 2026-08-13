"""Acceso al catálogo `filter_category` y a los valores de cada dimensión."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from src.models import FilterCategory
from src.repositories.bindings import FILTERABLE


@dataclass(frozen=True)
class SuggestRecord:
    """Un valor sugerido, con la categoría a la que pertenece."""

    display: str
    value: str
    category: str
    label: str


class FilterCategoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_enabled(self) -> list[FilterCategory]:
        return list(
            self._db.execute(
                select(FilterCategory)
                .where(FilterCategory.enabled.is_(True))
                .order_by(FilterCategory.order)
            ).scalars()
        )

    def distinct_values(self, key: str, q: str, limit: int) -> list[str]:
        """Valores distintos de una categoría, opcionalmente filtrados por `q`."""
        column = FILTERABLE[key].value_column
        stmt = select(column).distinct().order_by(column).limit(limit)
        if q:
            stmt = stmt.where(func.lower(column).like(f"%{q.lower()}%"))
        return [row[0] for row in self._db.execute(stmt).all() if row[0] is not None]

    def suggest(
        self, categories: Sequence[tuple[str, str]], q: str, per_category: int
    ) -> list[SuggestRecord]:
        """Autocomplete cross-categoría.

        `categories` son pares `(key, label)` del catálogo: la etiqueta la manda
        la DB, no se duplica en código.
        """
        if not categories:
            return []

        term = f"%{q.lower()}%"
        parts = []
        for key, label in categories:
            binding = FILTERABLE[key]
            # display y value coinciden en las dimensiones; en technique /
            # subtechnique difieren, y se busca en ambas.
            match_columns = {binding.display_column.key: binding.display_column}
            match_columns.setdefault(binding.value_column.key, binding.value_column)
            sub = (
                select(
                    binding.display_column.label("display"),
                    binding.value_column.label("value"),
                    literal(key).label("category"),
                    literal(label).label("label"),
                )
                .where(or_(*(func.lower(c).like(term) for c in match_columns.values())))
                .limit(per_category)
                .subquery()
            )
            # Envolver en subquery: un LIMIT directo dentro de un UNION ALL no es
            # portable entre dialectos.
            parts.append(select(sub.c.display, sub.c.value, sub.c.category, sub.c.label))

        rows = self._db.execute(union_all(*parts)).all()
        return [
            SuggestRecord(display=row[0], value=row[1], category=row[2], label=row[3])
            for row in rows
        ]
