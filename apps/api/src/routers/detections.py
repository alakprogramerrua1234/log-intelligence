from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from src.dependencies import get_detection_service
from src.schemas.detection import PaginatedDetections
from src.schemas.errors import ErrorOut
from src.services import DetectionService, parse_filters
from src.services.detections import DEFAULT_LIMIT, MAX_LIMIT

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get(
    "",
    response_model=PaginatedDetections,
    operation_id="listLogs",
    # Declarado para que `ErrorOut` entre en el esquema OpenAPI y el frontend
    # reciba el tipo del error generado, no escrito a mano.
    responses={400: {"model": ErrorOut, "description": "Unknown filter category or bad cursor"}},
)
def list_logs(
    request: Request,
    service: Annotated[DetectionService, Depends(get_detection_service)],
    q: Annotated[str, Query(description="Free-text search")] = "",
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: Annotated[
        str | None, Query(description="Opaque cursor from a previous next_cursor")
    ] = None,
) -> PaginatedDetections:
    """`GET /logs?filter[<key>]=<value>&q=...&limit=...&cursor=...`

    Las claves de filtro no se enumeran aquí: se descubren del catálogo en
    runtime. Una clave desconocida devuelve 400 (`unknown_filter_category`);
    un cursor manipulado o de otro backend, 400 (`invalid_cursor`).
    """
    filters = parse_filters(request.query_params.multi_items())
    return service.list_logs(filters, q=q, limit=limit, cursor=cursor)
