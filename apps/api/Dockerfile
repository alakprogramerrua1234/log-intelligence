# Una imagen, tres entrypoints. La API y la ingesta comparten modelos y
# repositorios, así que compartir imagen evita duplicar la capa de datos; lo que
# las separa es el comando, el ciclo de vida y el escalado, no el código.
#
#   docker build --target api    -t logintel-api .
#   docker build --target ingest -t logintel-ingest .

FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# Capa de dependencias aparte: el código cambia mucho más que el lockfile.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY alembic ./alembic
COPY src ./src

ENV PATH="/app/.venv/bin:$PATH"

RUN useradd --create-home --uid 1000 app && chown -R app:app /app
USER app


# ── API HTTP ──────────────────────────────────────────────────────────────────
FROM base AS api
EXPOSE 8001
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]


# ── Worker de ingesta: se ejecuta on-demand, no es un servicio long-running ───
FROM base AS ingest
ENTRYPOINT ["python", "-m", "src.ingest.load"]
CMD ["--help"]


# ── Reindexado de Meilisearch ────────────────────────────────────────────────
FROM base AS reindex
ENTRYPOINT ["python", "-m", "src.search.reindex"]
