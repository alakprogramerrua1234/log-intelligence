# Log Intelligence Platform

Plataforma para explorar logs de seguridad y su relación con técnicas de MITRE ATT&CK, centrada en logs en lugar de en técnicas.

> El procesamiento del dato (parseo, mapeo a ATT&CK, normalización) lo hace un **proyecto upstream independiente** del equipo. Esta app **ingiere** ese dataset ya construido y lo expone con búsqueda, filtrado y exploración interactiva.

## Stack

- **Web**: Next.js 16 + TypeScript + Tailwind + TanStack Table (virtualizada) + TanStack Query
- **API**: FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic
- **Datos**: PostgreSQL 16 — también resuelve la búsqueda, no hay motor aparte
- **Infra local**: Docker Compose
- **Deploy**: Vercel (web) + Fly.io (api + db)

> Para detalles de diseño y modelo de datos, ver [`ARCHITECTURE.md`](./ARCHITECTURE.md).
> Para convenciones y comandos de día a día, ver [`CLAUDE.md`](./CLAUDE.md).

## Estructura

```
log-intelligence/
├── apps/
│   ├── web/                  # Next.js 16
│   │   ├── src/app/          # /, /explore, /exploit
│   │   ├── src/components/   # log-table/, filters/, platform/, layout/
│   │   ├── src/lib/          # api.ts, url-state.ts, types/ (generados)
│   │   └── src/hooks/
│   └── api/                  # FastAPI
│       ├── src/
│       │   ├── main.py
│       │   ├── dependencies.py   # composition root
│       │   ├── routers/          # logs, filters
│       │   ├── services/         # lógica de dominio
│       │   ├── repositories/     # único sitio que habla SQLAlchemy
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── search/           # seam SearchBackend + cursores opacos
│       │   └── ingest/           # CLI de carga de datasets upstream
│       ├── tests/
│       ├── alembic/
│       └── openapi.json
├── .github/workflows/ci.yml
├── data/
├── docker-compose.yml
├── ARCHITECTURE.md
├── CLAUDE.md
└── README.md
```

El mapa detallado y las convenciones están en [`CLAUDE.md`](./CLAUDE.md) §3–§4.

## Requisitos

- Node 20+ y `pnpm` 9+
- Python 3.12+ y [`uv`](https://github.com/astral-sh/uv)
- Docker + Docker Compose

## Setup inicial

```bash
# 1. Clonar y entrar
git clone <repo> log-intelligence && cd log-intelligence

# 2. Variables de entorno
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 3. Levantar Postgres
docker compose up -d postgres

# 4. Instalar dependencias (web)
pnpm install

# 5. Instalar dependencias (api)
uv sync --directory apps/api

# 6. Migraciones
uv run --directory apps/api alembic upgrade head

# 7. Ingesta del dataset y arrancar dev
uv run --directory apps/api python -m src.ingest.load --source data/log_technique_map.csv
pnpm --filter web dev                                                      # http://localhost:3000
uv run --directory apps/api uvicorn src.main:app --reload --port 8001      # http://localhost:8001
```

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `pnpm --filter web dev` | Next dev server |
| `pnpm --filter web build` | Build de producción |
| `pnpm --filter web typecheck` | `tsc --noEmit` |
| `pnpm --filter web lint` | ESLint |
| `pnpm --filter web generate:types` | Regenera los tipos TS desde `apps/api/openapi.json` |
| `pnpm --filter web check:types` | Falla si los tipos generados están desactualizados (lo corre CI) |
| `uv run --directory apps/api uvicorn src.main:app --reload --port 8001` | API dev |
| `uv run --directory apps/api python scripts/export_openapi.py` | Exporta el OpenAPI tras cambiar un schema |
| `uv run --directory apps/api alembic revision --autogenerate -m "..."` | Nueva migración |
| `uv run --directory apps/api alembic upgrade head` | Aplicar migraciones |
| `uv run --directory apps/api pytest` | Tests del backend |
| `uv run --directory apps/api ruff check . && ruff format .` | Lint + format |
| `uv run --directory apps/api python -m src.ingest.load --source <src>` | Carga un dataset upstream |

## Puertos locales

| Servicio | Puerto |
|---|---|
| Web (Next.js) | 3000 |
| API (FastAPI) | 8001 |
| PostgreSQL | 5432 |

## Trabajando con Claude Code

Este repo está pensado para ser desarrollado con Claude Code. Antes de pedirle una tarea, asegúrate de:

1. Que `CLAUDE.md` esté al día.
2. Que `ARCHITECTURE.md` refleje cualquier decisión nueva. Las decisiones **abiertas** están en su §8.1 — conviene mirarlas antes de construir encima de ellas.
3. Mencionar archivos concretos (`@apps/web/src/components/log-table/LogTableClient.tsx`) en lugar de descripciones vagas.
4. Pedir vertical slices: una feature end-to-end es más fácil de revisar que un layer entero.
