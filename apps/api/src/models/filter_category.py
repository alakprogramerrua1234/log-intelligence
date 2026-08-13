from sqlalchemy import Boolean, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class FilterCategory(Base):
    """Catálogo de qué se puede filtrar.

    `source_table` / `value_column` / `detection_fk` no se convierten en SQL
    directamente: seleccionan un binding tipado de `repositories.bindings`.
    `services.filters.validate_catalog` comprueba al arrancar que coinciden.
    """

    __tablename__ = "filter_category"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    # tabla de origen de los valores
    source_table: Mapped[str] = mapped_column(Text, nullable=False)
    # columna cuyo valor viaja por la red (normalmente "name")
    value_column: Mapped[str] = mapped_column(Text, nullable=False)
    # columna de `detection` por la que se filtra
    detection_fk: Mapped[str] = mapped_column(Text, nullable=False)
    # string | enum | number
    value_type: Mapped[str] = mapped_column(Text, nullable=False)
    # dropdown | multiselect | text | chip
    ui_hint: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
