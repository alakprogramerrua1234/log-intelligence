from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.sql import Select
from sqlalchemy.orm import Session

from src.database import get_db
from src.models import Detection, EventId, LogSource, Platform, Subtechnique, Tactic, Technique
from src.schemas.detection import DetectionOut, PaginatedDetections, TechniqueRef

router = APIRouter(prefix="/logs", tags=["logs"])

_MAX_PAGE = 500

_SORT_COLUMNS: dict[str, Any] = {
    "log_source_name": LogSource.name,
    "event_id":        EventId.name,
    "tactic":          Tactic.name,
    "technique_id":    Technique.id,
}


def _build_query(
    filters: dict[str, list[str]],
    q: str = "",
    sort: str = "",
    sort_dir: str = "asc",
) -> Select[Any]:
    stmt = (
        select(
            Detection.id,
            Detection.log_source_id,
            Detection.subtechnique_id,
            LogSource.name.label("log_source_name"),
            EventId.name.label("event_id_name"),
            Tactic.name.label("tactic_name"),
            Technique.id.label("technique_id"),
            Technique.name.label("technique_name"),
            Subtechnique.id.label("sub_id"),
            Subtechnique.name.label("sub_name"),
        )
        .join(Platform, Detection.platform_id == Platform.id)
        .join(LogSource, Detection.log_source_id == LogSource.id)
        .join(EventId, Detection.event_id_id == EventId.id)
        .join(Tactic, Detection.tactic_id == Tactic.id)
        .join(Technique, Detection.technique_id == Technique.id)
        .outerjoin(Subtechnique, Detection.subtechnique_id == Subtechnique.id)
    )

    if q:
        term = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(LogSource.name).like(term),
                func.lower(EventId.name).like(term),
                func.lower(Tactic.name).like(term),
                func.lower(Technique.id).like(term),
                func.lower(Technique.name).like(term),
                func.lower(Subtechnique.id).like(term),
                func.lower(Subtechnique.name).like(term),
            )
        )

    _filter_map: dict[str, object] = {
        "platform":     Platform.name,
        "log_source":   LogSource.name,
        "event_id":     EventId.name,
        "tactic":       Tactic.name,
        "technique":    Technique.id,
        "subtechnique": Subtechnique.id,
    }
    for key, values in filters.items():
        col = _filter_map.get(key)
        if col is None:
            continue
        lower_vals = [v.lower() for v in values]
        stmt = stmt.where(func.lower(col).in_(lower_vals))

    sort_col = _SORT_COLUMNS.get(sort)
    if sort_col is not None:
        order_fn = desc if sort_dir == "desc" else asc
        stmt = stmt.order_by(order_fn(sort_col))
    else:
        stmt = stmt.order_by(asc(LogSource.name), asc(EventId.name))

    return stmt


@router.get("", response_model=PaginatedDetections)
def list_logs(
    db: Session = Depends(get_db),
    q: str = Query(default=""),
    limit: int = Query(default=200, ge=1, le=_MAX_PAGE),
    sort: str = Query(default=""),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    filter_platform: list[str] = Query(default=[], alias="filter[platform]"),
    filter_log_source: list[str] = Query(default=[], alias="filter[log_source]"),
    filter_event_id: list[str] = Query(default=[], alias="filter[event_id]"),
    filter_tactic: list[str] = Query(default=[], alias="filter[tactic]"),
    filter_technique: list[str] = Query(default=[], alias="filter[technique]"),
    filter_subtechnique: list[str] = Query(default=[], alias="filter[subtechnique]"),
) -> PaginatedDetections:
    filters: dict[str, list[str]] = {}
    if filter_platform:     filters["platform"]     = filter_platform
    if filter_log_source:   filters["log_source"]   = filter_log_source
    if filter_event_id:     filters["event_id"]     = filter_event_id
    if filter_tactic:       filters["tactic"]        = filter_tactic
    if filter_technique:    filters["technique"]     = filter_technique
    if filter_subtechnique: filters["subtechnique"]  = filter_subtechnique

    stmt = _build_query(filters, q, sort=sort, sort_dir=sort_dir)
    total: int = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.limit(limit)).all()

    items: list[DetectionOut] = []
    for row in rows:
        items.append(
            DetectionOut(
                id=str(row.id),
                log_source_id=str(row.log_source_id),
                log_source_name=row.log_source_name,
                event_id=row.event_id_name,
                name=row.sub_name or row.technique_name,
                techniques=[
                    TechniqueRef(
                        technique_id=row.technique_id,
                        technique_name=row.technique_name,
                        id=row.sub_id or row.technique_id,
                        name=row.sub_name or row.technique_name,
                        tactic=[row.tactic_name],
                        confidence=100,
                    )
                ],
            )
        )

    return PaginatedDetections(items=items, total=total)
