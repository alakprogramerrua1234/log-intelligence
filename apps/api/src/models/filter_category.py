from sqlalchemy import Boolean, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class FilterCategory(Base):
    __tablename__ = "filter_category"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    source_table: Mapped[str] = mapped_column(Text, nullable=False)   # dimension table name
    value_column: Mapped[str] = mapped_column(Text, nullable=False)   # column shown to user (usually "name")
    detection_fk: Mapped[str] = mapped_column(Text, nullable=False)   # FK column in detection table
    value_type: Mapped[str] = mapped_column(Text, nullable=False)     # string | enum | number
    ui_hint: Mapped[str] = mapped_column(Text, nullable=False)        # dropdown | multiselect | text | chip
    order: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
