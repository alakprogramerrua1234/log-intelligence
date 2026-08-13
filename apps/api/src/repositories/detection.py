"""Acceso a la tabla de hechos `detection`. Único sitio que ejecuta esta query."""

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from src.models import Detection, EventId, LogSource, Platform, Subtechnique, Tactic, Technique
from src.repositories.bindings import apply_filters, search_predicate

_SelectT = TypeVar("_SelectT", bound=Select[Any])


@dataclass(frozen=True)
class DetectionRecord:
    """Una fila de `detection` con sus dimensiones ya resueltas.

    Tipo de frontera: aísla a los services de la forma de la query y de
    SQLAlchemy. Lo que sale de aquí ya no sabe nada de la DB.
    """

    id: int
    platform: str
    log_source_id: int
    log_source_name: str
    event_id: str
    tactic: str
    technique_id: str
    technique_name: str
    subtechnique_id: str | None
    subtechnique_name: str | None


class DetectionRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    # ── consultas ────────────────────────────────────────────────────────────

    def count(self, filters: Mapping[str, Sequence[str]], q: str) -> int:
        stmt = self._matching(filters, q)
        total: int = self._db.execute(
            select(func.count()).select_from(stmt.subquery())
        ).scalar_one()
        return total

    def matching_ids(
        self,
        filters: Mapping[str, Sequence[str]],
        q: str,
        limit: int,
        after_id: int | None = None,
    ) -> list[int]:
        """Ids que casan, en orden estable por `id` (keyset a partir de `after_id`)."""
        stmt = self._matching(filters, q)
        if after_id is not None:
            stmt = stmt.where(Detection.id > after_id)
        stmt = stmt.order_by(Detection.id).limit(limit)
        return [row[0] for row in self._db.execute(stmt).all()]

    def get_by_ids(self, ids: Sequence[int]) -> list[DetectionRecord]:
        """Hidrata ids preservando el orden recibido.

        El orden lo decide el backend de búsqueda (relevancia en Meilisearch,
        `id` en Postgres), así que no se puede delegar en un ORDER BY de SQL.
        """
        if not ids:
            return []
        rows = self._db.execute(self._hydrate().where(Detection.id.in_(ids))).all()
        by_id = {row.id: _to_record(row) for row in rows}
        return [by_id[detection_id] for detection_id in ids if detection_id in by_id]

    def iter_records(self, batch_size: int = 1000) -> Iterator[DetectionRecord]:
        """Todas las detecciones, en streaming. Lo usa el indexador.

        Streaming y no `.all()`: el dataset crece y reindexar no debe cargarlo
        entero en memoria.
        """
        result = self._db.execute(
            self._hydrate().order_by(Detection.id).execution_options(yield_per=batch_size)
        )
        for row in result:
            yield _to_record(row)

    # ── construcción de queries ──────────────────────────────────────────────

    def _matching(
        self, filters: Mapping[str, Sequence[str]], q: str
    ) -> Select[tuple[int]]:
        stmt = self._joined(select(Detection.id))
        if q:
            stmt = stmt.where(search_predicate(q))
        return apply_filters(stmt, filters)

    def _hydrate(self) -> Select[Any]:
        return self._joined(
            select(
                Detection.id,
                Platform.name.label("platform_name"),
                Detection.log_source_id,
                LogSource.name.label("log_source_name"),
                EventId.name.label("event_id_name"),
                Tactic.name.label("tactic_name"),
                Technique.id.label("technique_id"),
                Technique.name.label("technique_name"),
                Subtechnique.id.label("subtechnique_id"),
                Subtechnique.name.label("subtechnique_name"),
            )
        )

    @staticmethod
    def _joined(stmt: _SelectT) -> _SelectT:
        """Los mismos joins para contar, listar ids e hidratar."""
        return (
            stmt.join(Platform, Detection.platform_id == Platform.id)
            .join(LogSource, Detection.log_source_id == LogSource.id)
            .join(EventId, Detection.event_id_id == EventId.id)
            .join(Tactic, Detection.tactic_id == Tactic.id)
            .join(Technique, Detection.technique_id == Technique.id)
            .outerjoin(Subtechnique, Detection.subtechnique_id == Subtechnique.id)
        )


def _to_record(row: Any) -> DetectionRecord:
    return DetectionRecord(
        id=row.id,
        platform=row.platform_name,
        log_source_id=row.log_source_id,
        log_source_name=row.log_source_name,
        event_id=row.event_id_name,
        tactic=row.tactic_name,
        technique_id=row.technique_id,
        technique_name=row.technique_name,
        subtechnique_id=row.subtechnique_id,
        subtechnique_name=row.subtechnique_name,
    )
