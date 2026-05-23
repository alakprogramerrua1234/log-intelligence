import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, SmallInteger, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .log import Log
    from .technique import Technique


class LogTechniqueMapping(Base):
    __tablename__ = "log_technique_mapping"
    __table_args__ = (
        Index("ix_log_technique_mapping_technique_id", "technique_id"),
    )

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("log.id", ondelete="CASCADE"),
        primary_key=True,
    )
    technique_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("technique.id", ondelete="CASCADE"),
        primary_key=True,
    )
    confidence: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataset_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    log: Mapped["Log"] = relationship(back_populates="technique_mappings")
    technique: Mapped["Technique"] = relationship(back_populates="log_mappings")
