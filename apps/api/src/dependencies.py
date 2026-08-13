"""Composition root: ata repositories, backends y services para los routers.

Es el único módulo fuera de `repositories/` que conoce la `Session`, y existe
precisamente para que los routers no la vean.
"""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from src.config import settings
from src.database import get_db
from src.repositories import DetectionRepository, FilterCategoryRepository
from src.search import MeilisearchBackend, PostgresSearchBackend, SearchBackend
from src.search.client import HttpMeiliClient
from src.services import DetectionService, FilterService

DbSession = Annotated[Session, Depends(get_db)]


def get_search_backend(db: DbSession) -> Iterator[SearchBackend]:
    """Elige backend según config. Postgres es el default y no necesita nada más.

    El cliente HTTP se abre y cierra por request: mantener un pool global
    complicaría el ciclo de vida a cambio de poco, dado que la latencia dominante
    es la query, no el handshake.
    """
    if settings.search_backend == "meilisearch":
        client = HttpMeiliClient(settings.meilisearch_url, settings.meilisearch_api_key)
        try:
            yield MeilisearchBackend(client, settings.meilisearch_index)
        finally:
            client.close()
    else:
        yield PostgresSearchBackend(DetectionRepository(db))


SearchBackendDep = Annotated[SearchBackend, Depends(get_search_backend)]


def get_detection_service(db: DbSession, search: SearchBackendDep) -> DetectionService:
    return DetectionService(
        DetectionRepository(db), FilterCategoryRepository(db), search
    )


def get_filter_service(db: DbSession) -> FilterService:
    return FilterService(FilterCategoryRepository(db))
