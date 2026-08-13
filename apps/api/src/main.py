from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src import database
from src.repositories import FilterCategoryRepository
from src.routers import detections, filters
from src.schemas.errors import ErrorOut
from src.search import InvalidCursorError
from src.services import UnknownFilterCategoryError, UnknownSortKeyError, validate_catalog

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Falla al arrancar si el catálogo de filtros no concuerda con el código.

    Preferimos no arrancar antes que servir queries en las que un filtro
    declarado en la DB se ignora en silencio.
    """
    with database.SessionLocal() as session:
        validate_catalog(FilterCategoryRepository(session).list_enabled())
    yield


app = FastAPI(title="Log Intelligence API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _handle_unknown_filter_category(_: Request, exc: Exception) -> JSONResponse:
    keys = exc.keys if isinstance(exc, UnknownFilterCategoryError) else []
    error = ErrorOut(detail=str(exc), code="unknown_filter_category", keys=keys)
    return JSONResponse(status_code=400, content=error.model_dump())


async def _handle_invalid_cursor(_: Request, exc: Exception) -> JSONResponse:
    error = ErrorOut(detail=str(exc), code="invalid_cursor")
    return JSONResponse(status_code=400, content=error.model_dump())


async def _handle_unknown_sort_key(_: Request, exc: Exception) -> JSONResponse:
    keys = [exc.key] if isinstance(exc, UnknownSortKeyError) else []
    error = ErrorOut(detail=str(exc), code="unknown_sort_key", keys=keys)
    return JSONResponse(status_code=400, content=error.model_dump())


app.add_exception_handler(UnknownFilterCategoryError, _handle_unknown_filter_category)
app.add_exception_handler(UnknownSortKeyError, _handle_unknown_sort_key)
app.add_exception_handler(InvalidCursorError, _handle_invalid_cursor)

# `include_router` con prefijo en vez de `app.mount`: un sub-app montado queda
# fuera del esquema OpenAPI del padre, y los tipos del frontend se generan a
# partir de ese esquema (ver apps/web/package.json::generate:types).
app.include_router(detections.router, prefix=API_PREFIX)
app.include_router(filters.router, prefix=API_PREFIX)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
