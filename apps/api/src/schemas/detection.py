from typing import Any

from pydantic import BaseModel, ConfigDict


class TechniqueRef(BaseModel):
    technique_id: str    # parent technique, e.g. "T1059"
    technique_name: str  # parent technique name
    id: str              # subtechnique id (equals technique_id when no subtechnique)
    name: str            # subtechnique name (equals technique_name when no subtechnique)
    tactic: list[str]
    confidence: int


class DetectionOut(BaseModel):
    """One detection row, denormalized for the frontend Log type."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    log_source_id: str
    log_source_name: str
    event_id: str | None
    name: str
    techniques: list[TechniqueRef]

    # Campos que el dataset upstream todavía no trae. Se declaran opcionales, no
    # `None` fijo: así el tipo generado para el frontend ya es el definitivo y
    # rellenarlos más adelante no rompe el contrato.
    provider: str | None = None
    description: str | None = None
    sample_fields: dict[str, Any] | None = None
    relevance: int = 0


class PaginatedDetections(BaseModel):
    items: list[DetectionOut]
    total: int
    next_cursor: str | None = None
