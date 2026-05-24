from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Subtechnique(Base):
    __tablename__ = "subtechnique"
    __table_args__ = (Index("ix_subtechnique_technique_id", "technique_id"),)

    # PK is the ATT&CK ID assigned upstream (e.g. "T1059.001")
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    technique_id: Mapped[str] = mapped_column(
        Text, ForeignKey("technique.id", ondelete="CASCADE"), nullable=False
    )
