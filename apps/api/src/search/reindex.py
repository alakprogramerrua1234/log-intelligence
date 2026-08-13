"""Reindexado de Meilisearch: función reutilizable + CLI.

    uv run --directory apps/api python -m src.search.reindex
    uv run --directory apps/api python -m src.search.reindex --index detections

La ingesta llama a `reindex_from_settings` al terminar una carga, así que la
lógica vive aquí y no duplicada en `src.ingest`.
"""

import argparse
import sys
from collections.abc import Callable

from sqlalchemy.orm import Session

from src.config import settings
from src.database import SessionLocal
from src.repositories import DetectionRepository, FilterCategoryRepository
from src.search.client import HttpMeiliClient, MeiliError
from src.search.indexer import DEFAULT_BATCH_SIZE, IndexReport, reindex
from src.services import FilterCatalogError, validate_catalog


def reindex_from_settings(
    index: str | None = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
    session_factory: Callable[[], Session] = SessionLocal,
) -> IndexReport:
    """Reconstruye el índice usando la configuración del entorno."""
    client = HttpMeiliClient(settings.meilisearch_url, settings.meilisearch_api_key)
    try:
        with session_factory() as session:
            categories = FilterCategoryRepository(session).list_enabled()
            # Mismo chequeo que al arrancar la API: indexar con un catálogo
            # inconsistente produciría filtros que no filtran.
            validate_catalog(categories)
            return reindex(
                client,
                index or settings.meilisearch_index,
                categories,
                DetectionRepository(session).iter_records(),
                batch_size=batch_size,
            )
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild the Meilisearch index.")
    parser.add_argument("--index", default=None, help="Index name (defaults to config)")
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Documents per request"
    )
    args = parser.parse_args()

    try:
        report = reindex_from_settings(args.index, args.batch_size)
    except (MeiliError, FilterCatalogError) as exc:
        print(f"Reindex failed: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Reindexed '{args.index or settings.meilisearch_index}'\n"
        f"  documents:  {report.documents}\n"
        f"  filterable: {', '.join(report.filterable)}\n"
        f"  searchable: {', '.join(report.searchable)}\n"
    )


if __name__ == "__main__":
    main()
