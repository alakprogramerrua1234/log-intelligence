from pydantic import BaseModel, ConfigDict


class TechniqueRef(BaseModel):
    id: str
    name: str
    tactic: list[str]
    confidence: int


class DetectionOut(BaseModel):
    """One detection row, denormalized for the frontend Log type."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    log_source_id: str
    log_source_name: str
    event_id: str | None
    provider: None = None
    name: str
    description: None = None
    sample_fields: None = None
    relevance: int = 0
    techniques: list[TechniqueRef]


class PaginatedDetections(BaseModel):
    items: list[DetectionOut]
    total: int
    next_cursor: str | None = None
