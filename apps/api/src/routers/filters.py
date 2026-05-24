from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import get_db
from src.models import FilterCategory
from src.schemas.filter_category import FilterCategoryOut

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get("/categories", response_model=list[FilterCategoryOut])
def get_filter_categories(db: Session = Depends(get_db)) -> list[FilterCategory]:
    return list(
        db.execute(
            select(FilterCategory).where(FilterCategory.enabled.is_(True)).order_by(FilterCategory.order)
        ).scalars()
    )
