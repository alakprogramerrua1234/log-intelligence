import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, SmallInteger, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .log_source import LogSource
    from .log_technique_mapping import LogTechniqueMapping


class Log(Base):
    __tablename__ = "log"
    __table_args__ = (
        UniqueConstraint("log_source_id", "channel", "event_id", name="uq_log_source_channel_event"),
        Index("ix_log_log_source_id", "log_source_id"),
        Index("ix_log_sample_fields_gin", "sample_fields", postgresql_using="gin"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    log_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("log_source.id", ondelete="CASCADE"), nullable=False
    )
    channel: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str | None] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    relevance: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    log_source: Mapped["LogSource"] = relationship(back_populates="logs")
    technique_mappings: Mapped[list["LogTechniqueMapping"]] = relationship(back_populates="log")
