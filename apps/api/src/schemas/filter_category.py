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
