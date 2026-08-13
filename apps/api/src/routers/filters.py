from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from src.dependencies import get_filter_service
from src.schemas.filter_category import FilterCategoryOut, SuggestItem
from src.services import FilterService, UnknownFilterCategoryError
from src.services.filters import DEFAULT_SUGGEST_PER_CATEGORY, DEFAULT_VALUES_LIMIT

router = APIRouter(prefix="/filters", tags=["filters"])

FilterServiceDep = Annotated[FilterService, Depends(get_filter_service)]


@router.get(
    "/categories", response_model=list[FilterCategoryOut], operation_id="listFilterCategories"
)
def get_filter_categories(service: FilterServiceDep) -> list[FilterCategoryOut]:
    return [FilterCategoryOut.model_validate(c) for c in service.list_categories()]


@router.get("/values", response_model=list[str], operation_id="listFilterValues")
def get_filter_values(
    category: str,
    service: FilterServiceDep,
    q: Annotated[str, Query()] = "",
    limit: Annotated[int, Query(ge=1, le=1000)] = DEFAULT_VALUES_LIMIT,
) -> list[str]:
    try:
        return service.values(category, q, limit)
    except UnknownFilterCategoryError as exc:
        raise HTTPException(
            status_code=404, detail=f"Unknown filter category: {category}"
        ) from exc


@router.get("/suggest", response_model=list[SuggestItem], operation_id="suggestFilterValues")
def suggest(
    service: FilterServiceDep,
    q: Annotated[str, Query(min_length=1)],
    per_category: Annotated[int, Query(ge=1, le=20)] = DEFAULT_SUGGEST_PER_CATEGORY,
) -> list[SuggestItem]:
    """Autocomplete cross-categoría. Las categorías salen del catálogo, no de código."""
    return [
        SuggestItem(display=r.display, value=r.value, category=r.category, label=r.label)
        for r in service.suggest(q, per_category)
    ]
