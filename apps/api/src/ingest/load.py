"""
CLI de ingesta: carga un CSV de detecciones en la DB.

Uso:
    uv run --directory apps/api python -m src.ingest.load --source data/sample.csv
    uv run --directory apps/api python -m src.ingest.load --source data/sample.csv --dry-run
"""

import argparse
import csv
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

from pydantic import ValidationError
from sqlalchemy import Table
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.ingest.schemas import DetectionRow
from src.models import (
    Detection,
    EventId,
    FilterCategory,
    LogSource,
    Platform,
    Subtechnique,
    Tactic,
    Technique,
)

# ── filter_category seed ──────────────────────────────────────────────────────
FILTER_CATEGORIES: list[dict[str, Any]] = [
    {
        "key": "platform",
        "label": "Platform",
        "source_table": "platform",
        "value_column": "name",
        "detection_fk": "platform_id",
        "value_type": "enum",
        "ui_hint": "dropdown",
        "order": 1,
        "enabled": True,
    },
    {
        "key": "log_source",
        "label": "Log Source",
        "source_table": "log_source",
        "value_column": "name",
        "detection_fk": "log_source_id",
        "value_type": "string",
        "ui_hint": "multiselect",
        "order": 2,
        "enabled": True,
    },
    {
        "key": "event_id",
        "label": "Event ID",
        "source_table": "event_id",
        "value_column": "name",
        "detection_fk": "event_id_id",
        "value_type": "string",
        "ui_hint": "multiselect",
        "order": 3,
        "enabled": True,
    },
    {
        "key": "tactic",
        "label": "Tactic",
        "source_table": "tactic",
        "value_column": "name",
        "detection_fk": "tactic_id",
        "value_type": "enum",
        "ui_hint": "chip",
        "order": 4,
        "enabled": True,
    },
    {
        "key": "technique",
        "label": "Technique",
        "source_table": "technique",
        "value_column": "id",
        "detection_fk": "technique_id",
        "value_type": "string",
        "ui_hint": "multiselect",
        "order": 5,
        "enabled": True,
    },
    {
        "key": "subtechnique",
        "label": "Sub-technique",
        "source_table": "subtechnique",
        "value_column": "id",
        "detection_fk": "subtechnique_id",
        "value_type": "string",
        "ui_hint": "multiselect",
        "order": 6,
        "enabled": True,
    },
]


# ── dimension upsert helpers ──────────────────────────────────────────────────

def _upsert_dim(session: Session, table: Any, name: str, cache: dict[str, int]) -> int:
    if name in cache:
        return cache[name]
    stmt = (
        pg_insert(table.__table__)
        .values(name=name)
        .on_conflict_do_update(index_elements=["name"], set_={"name": name})
        .returning(table.__table__.c.id)
    )
    row_id: int = session.execute(stmt).scalar_one()
    cache[name] = row_id
    return row_id


def _upsert_technique(session: Session, technique_id: str, name: str) -> None:
    stmt = (
        pg_insert(cast(Table, Technique.__table__))
        .values(id=technique_id, name=name)
        .on_conflict_do_update(index_elements=["id"], set_={"name": name})
    )
    session.execute(stmt)


def _upsert_subtechnique(
    session: Session, sub_id: str, name: str, technique_id: str
) -> None:
    stmt = (
        pg_insert(cast(Table, Subtechnique.__table__))
        .values(id=sub_id, name=name, technique_id=technique_id)
        .on_conflict_do_update(
            index_elements=["id"], set_={"name": name, "technique_id": technique_id}
        )
    )
    session.execute(stmt)


def _seed_filter_categories(session: Session) -> None:
    stmt = pg_insert(cast(Table, FilterCategory.__table__)).on_conflict_do_nothing(
        index_elements=["key"]
    )
    session.execute(stmt, FILTER_CATEGORIES)


# ── main ──────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class LoadReport:
    """Resultado de una carga. Lo devuelve `load` para poder afirmarlo en tests."""

    rows_read: int
    rows_invalid: int
    rows_inserted: int
    rows_duplicate: int
    platforms: int
    log_sources: int
    event_ids: int
    tactics: int
    seconds: float


def load(
    source: Path,
    dry_run: bool,
    session_factory: Callable[[], Session] = SessionLocal,
) -> LoadReport:
    """Carga un CSV. Idempotente: reejecutarla deja la DB igual.

    `session_factory` se inyecta para que los tests usen una DB efímera sin
    tocar la configuración global.
    """
    t0 = time.perf_counter()

    platform_cache: dict[str, int] = {}
    log_source_cache: dict[str, int] = {}
    event_id_cache: dict[str, int] = {}
    tactic_cache: dict[str, int] = {}

    rows_read = 0
    rows_invalid = 0
    rows_inserted = 0
    rows_duplicate = 0

    session: Session = session_factory()
    try:
        _seed_filter_categories(session)

        with source.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for raw in reader:
                rows_read += 1

                # Strip None keys that DictReader creates for extra trailing commas
                clean = {k: v for k, v in raw.items() if k is not None}

                try:
                    row = DetectionRow.model_validate(clean)
                except ValidationError as exc:
                    rows_invalid += 1
                    print(
                        f"  [row {rows_read}] validation error: {exc.errors()[0]['msg']}",
                        file=sys.stderr,
                    )
                    continue

                platform_id  = _upsert_dim(session, Platform,  row.platform,  platform_cache)
                log_source_id = _upsert_dim(session, LogSource, row.log_source, log_source_cache)
                eid_id        = _upsert_dim(session, EventId,   row.event_id,   event_id_cache)
                tactic_id    = _upsert_dim(session, Tactic,    row.tactic,     tactic_cache)

                _upsert_technique(session, row.technique_id, row.technique_name)
                if row.has_subtechnique:
                    _upsert_subtechnique(
                        session, row.subtechnique_id, row.subtechnique_name, row.technique_id
                    )

                det_stmt = (
                    pg_insert(cast(Table, Detection.__table__))
                    .values(
                        platform_id=platform_id,
                        log_source_id=log_source_id,
                        event_id_id=eid_id,
                        tactic_id=tactic_id,
                        technique_id=row.technique_id,
                        subtechnique_id=row.subtechnique_id or None,
                    )
                    .on_conflict_do_nothing(constraint="uq_detection_combination")
                    # RETURNING y no `rowcount`: con psycopg3 este INSERT
                    # devuelve rowcount -1, así que compararlo con 1 contaba
                    # TODAS las filas como duplicadas. `ON CONFLICT DO NOTHING`
                    # solo devuelve fila cuando ha insertado de verdad.
                    .returning(cast(Table, Detection.__table__).c.id)
                )
                if session.execute(det_stmt).scalar_one_or_none() is not None:
                    rows_inserted += 1
                else:
                    rows_duplicate += 1

        if dry_run:
            session.rollback()
            print("Dry-run: rolled back all changes.")
        else:
            session.commit()

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return LoadReport(
        rows_read=rows_read,
        rows_invalid=rows_invalid,
        rows_inserted=rows_inserted,
        rows_duplicate=rows_duplicate,
        platforms=len(platform_cache),
        log_sources=len(log_source_cache),
        event_ids=len(event_id_cache),
        tactics=len(tactic_cache),
        seconds=time.perf_counter() - t0,
    )


def _print_report(report: LoadReport, dry_run: bool) -> None:
    action = "would insert" if dry_run else "inserted"
    print(
        f"\nDone in {report.seconds:.2f}s\n"
        f"  rows read:      {report.rows_read}\n"
        f"  invalid:        {report.rows_invalid}\n"
        f"  {action}:  {report.rows_inserted}\n"
        f"  duplicates:     {report.rows_duplicate}\n"
        f"  platforms:      {report.platforms}\n"
        f"  log_sources:    {report.log_sources}\n"
        f"  event_ids:      {report.event_ids}\n"
        f"  tactics:        {report.tactics}\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Load detections CSV into the database.")
    parser.add_argument("--source", required=True, help="Path to the CSV file")
    parser.add_argument("--dry-run", action="store_true", help="Validate without committing")
    args = parser.parse_args()

    source = Path(args.source)
    if not source.exists():
        print(f"Error: file not found: {source}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {source} {'(dry-run)' if args.dry_run else ''}...")
    report = load(source, dry_run=args.dry_run)
    _print_report(report, args.dry_run)


if __name__ == "__main__":
    main()
