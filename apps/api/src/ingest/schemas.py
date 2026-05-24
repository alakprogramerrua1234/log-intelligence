from pydantic import BaseModel, model_validator


class DetectionRow(BaseModel):
    """One row from the upstream CSV. All fields arrive as strings from csv.DictReader."""

    platform: str
    log_source: str
    event_id: str
    tactic: str
    technique_id: str
    technique_name: str
    subtechnique_id: str = ""
    subtechnique_name: str = ""

    @model_validator(mode="after")
    def subtechnique_consistency(self) -> "DetectionRow":
        if self.subtechnique_id and not self.subtechnique_name:
            raise ValueError("subtechnique_id requires subtechnique_name")
        if self.subtechnique_name and not self.subtechnique_id:
            raise ValueError("subtechnique_name requires subtechnique_id")
        return self

    @property
    def has_subtechnique(self) -> bool:
        return bool(self.subtechnique_id)
