from sqlalchemy import BigInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Tactic(Base):
    __tablename__ = "tactic"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
