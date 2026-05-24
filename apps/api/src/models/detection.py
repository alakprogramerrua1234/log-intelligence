from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Detection(Base):
    __tablename__ = "detection"
    __table_args__ = (
        UniqueConstraint(
            "platform_id",
            "log_source_id",
            "event_id_id",
            "tactic_id",
            "technique_id",
            "subtechnique_id",
            name="uq_detection_combination",
            postgresql_nulls_not_distinct=True,
        ),
        Index("ix_detection_platform_id", "platform_id"),
        Index("ix_detection_log_source_id", "log_source_id"),
        Index("ix_detection_event_id_id", "event_id_id"),
        Index("ix_detection_tactic_id", "tactic_id"),
        Index("ix_detection_technique_id", "technique_id"),
        Index("ix_detection_subtechnique_id", "subtechnique_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    platform_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("platform.id", ondelete="RESTRICT"), nullable=False
    )
    log_source_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("log_source.id", ondelete="RESTRICT"), nullable=False
    )
    event_id_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("event_id.id", ondelete="RESTRICT"), nullable=False
    )
    tactic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tactic.id", ondelete="RESTRICT"), nullable=False
    )
    technique_id: Mapped[str] = mapped_column(
        Text, ForeignKey("technique.id", ondelete="RESTRICT"), nullable=False
    )
    subtechnique_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("subtechnique.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
