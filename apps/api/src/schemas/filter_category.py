from pydantic import BaseModel, ConfigDict


class FilterCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    source_table: str
    value_column: str
    detection_fk: str
    value_type: str
    ui_hint: str
    order: int
    enabled: bool


class SuggestItem(BaseModel):
    display: str   # human-readable value shown in the UI
    value: str     # actual filter value sent to the API (may differ, e.g. technique uses ID)
    category: str  # filter category key ("technique", "log_source", …)
    label: str     # human-readable category label ("Technique Name", "Log Source", …)
