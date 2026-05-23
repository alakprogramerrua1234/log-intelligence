import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .log_source import LogSource


class Platform(Base):
    __tablename__ = "platform"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)  # os | cloud | saas | network
    icon: Mapped[str | None] = mapped_column(Text, nullable=True)

    log_sources: Mapped[list["LogSource"]] = relationship(back_populates="platform")
