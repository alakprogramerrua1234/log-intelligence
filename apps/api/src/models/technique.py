from typing import TYPE_CHECKING

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .log_technique_mapping import LogTechniqueMapping


class Technique(Base):
    __tablename__ = "technique"

    # Text PK — upstream assigns IDs like "T1059.001"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    tactic: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataset_version: Mapped[str | None] = mapped_column(Text, nullable=True)

    log_mappings: Mapped[list["LogTechniqueMapping"]] = relationship(back_populates="technique")
