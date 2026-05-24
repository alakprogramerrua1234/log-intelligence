from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Technique(Base):
    __tablename__ = "technique"

    # PK is the ATT&CK ID assigned upstream (e.g. "T1059")
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
