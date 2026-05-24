from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from src.database import get_db
from src.models import EventId, FilterCategory, LogSource, Platform, Subtechnique, Tactic, Technique
from src.schemas.filter_category import FilterCategoryOut, SuggestItem

router = APIRouter(prefix="/filters", tags=["filters"])

_VALUE_COLUMNS: dict[str, object] = {
    "platform":     Platform.name,
    "log_source":   LogSource.name,
    "event_id":     EventId.name,
    "tactic":       Tactic.name,
    "technique":    Technique.id,
    "subtechnique": Subtechnique.id,
}

_PER_CATEGORY = 4


@router.get("/categories", response_model=list[FilterCategoryOut])
def get_filter_categories(db: Session = Depends(get_db)) -> list[FilterCategory]:
    return list(
        db.execute(
            select(FilterCategory).where(FilterCategory.enabled.is_(True)).order_by(FilterCategory.order)
        ).scalars()
    )


@router.get("/values", response_model=list[str])
def get_filter_values(
    category: str,
    q: str = Query(default=""),
    db: Session = Depends(get_db),
) -> list[str]:
    col = _VALUE_COLUMNS.get(category)
    if col is None:
        raise HTTPException(status_code=404, detail=f"Unknown filter category: {category}")
    stmt = select(col).distinct().order_by(col)
    if q:
        stmt = stmt.where(func.lower(col).like(f"%{q.lower()}%"))
    return [row[0] for row in db.execute(stmt).all() if row[0] is not None]


@router.get("/suggest", response_model=list[SuggestItem])
def suggest(
    q: str = Query(min_length=1),
    db: Session = Depends(get_db),
) -> list[SuggestItem]:
    """Cross-category suggest: returns matching values from all dimension tables."""
    term = f"%{q.lower()}%"
    n = _PER_CATEGORY

    sub_queries = [
        select(
            Platform.name.label("display"),
            Platform.name.label("value"),
            literal("platform").label("category"),
            literal("Platform").label("label"),
        ).where(func.lower(Platform.name).like(term)).limit(n),

        select(
            LogSource.name.label("display"),
            LogSource.name.label("value"),
            literal("log_source").label("category"),
            literal("Log Source").label("label"),
        ).where(func.lower(LogSource.name).like(term)).limit(n),

        select(
            EventId.name.label("display"),
            EventId.name.label("value"),
            literal("event_id").label("category"),
            literal("Event ID").label("label"),
        ).where(func.lower(EventId.name).like(term)).limit(n),

        select(
            Tactic.name.label("display"),
            Tactic.name.label("value"),
            literal("tactic").label("category"),
            literal("Tactic").label("label"),
        ).where(func.lower(Tactic.name).like(term)).limit(n),

        select(
            Technique.name.label("display"),
            Technique.id.label("value"),
            literal("technique").label("category"),
            literal("Technique Name").label("label"),
        ).where(
            or_(func.lower(Technique.name).like(term), func.lower(Technique.id).like(term))
        ).limit(n),

        select(
            Subtechnique.name.label("display"),
            Subtechnique.id.label("value"),
            literal("subtechnique").label("category"),
            literal("Subtechnique Name").label("label"),
        ).where(
            or_(func.lower(Subtechnique.name).like(term), func.lower(Subtechnique.id).like(term))
        ).limit(n),
    ]

    rows = db.execute(union_all(*sub_queries)).all()
    return [SuggestItem(display=r[0], value=r[1], category=r[2], label=r[3]) for r in rows]
