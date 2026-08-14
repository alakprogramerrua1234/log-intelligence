"""Lógica de dominio de la tabla de logs."""

from collections.abc import Mapping, Sequence

from src.repositories import DetectionRecord, DetectionRepository, FilterCategoryRepository
from src.schemas.detection import DetectionOut, PaginatedDetections, TechniqueRef
from src.search.backend import SearchBackend
from src.services.filters import parse_sort, validate_filters

DEFAULT_LIMIT = 200
MAX_LIMIT = 500


class DetectionService:
    def __init__(
        self,
        detections: DetectionRepository,
        catalog: FilterCategoryRepository,
        search: SearchBackend,
    ) -> None:
        self._detections = detections
        self._catalog = catalog
        self._search = search

    def list_logs(
        self,
        filters: Mapping[str, Sequence[str]],
        q: str = "",
        limit: int = DEFAULT_LIMIT,
        cursor: str | None = None,
        sort: str = "",
        sort_dir: str = "asc",
    ) -> PaginatedDetections:
        enabled_keys = [category.key for category in self._catalog.list_enabled()]
        validate_filters(filters, enabled_keys)
        sort_spec = parse_sort(sort, sort_dir)

        # El backend decide qué casa y en qué orden; el repositorio solo hidrata.
        # Ese reparto es lo que permite cambiar de motor de búsqueda sin tocar
        # ni el router ni la forma de la respuesta.
        page = self._search.search(q, filters, limit, cursor, sort_spec)
        records = self._detections.get_by_ids(page.ids)

        return PaginatedDetections(
            items=[_to_schema(record) for record in records],
            total=page.total,
            next_cursor=page.next_cursor,
        )


def _to_schema(record: DetectionRecord) -> DetectionOut:
    """Aplana una detección al tipo `Log` que consume el frontend.

    Cuando no hay subtécnica, los campos de subtécnica caen a los de la técnica
    padre: la UI trata ambos casos igual.
    """
    leaf_id = record.subtechnique_id or record.technique_id
    leaf_name = record.subtechnique_name or record.technique_name
    return DetectionOut(
        id=str(record.id),
        log_source_id=str(record.log_source_id),
        log_source_name=record.log_source_name,
        event_id=record.event_id,
        name=leaf_name,
        techniques=[
            TechniqueRef(
                technique_id=record.technique_id,
                technique_name=record.technique_name,
                id=leaf_id,
                name=leaf_name,
                tactic=[record.tactic],
                confidence=100,
            )
        ],
    )
