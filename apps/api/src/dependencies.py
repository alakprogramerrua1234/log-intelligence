"""Composition root: ata repositories, backends y services para los routers.

Es el único módulo fuera de `repositories/` que conoce la `Session`, y existe
precisamente para que los routers no la vean.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.repositories import DetectionRepository, FilterCategoryRepository
from src.search import PostgresSearchBackend, SearchBackend
from src.services import DetectionService, FilterService

DbSession = Annotated[Session, Depends(get_db)]


def get_search_backend(db: DbSession) -> SearchBackend:
    """Resuelve el backend de búsqueda.

    Hoy solo hay uno. Sigue pasando por aquí —y tipado como `SearchBackend`, no
    como la implementación— para que sustituirlo sea cambiar esta función y nada
    más.
    """
    return PostgresSearchBackend(DetectionRepository(db))


SearchBackendDep = Annotated[SearchBackend, Depends(get_search_backend)]


def get_detection_service(db: DbSession, search: SearchBackendDep) -> DetectionService:
    return DetectionService(
        DetectionRepository(db), FilterCategoryRepository(db), search
    )


def get_filter_service(db: DbSession) -> FilterService:
    return FilterService(FilterCategoryRepository(db))
