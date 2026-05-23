# Log Intelligence Platform — Guía para Claude Code

> Este archivo es el contexto que Claude Code carga en cada sesión. Mantenerlo corto, vivo y honesto.
> Si una decisión cambia en el código, actualízalo aquí en el mismo PR.

---

## 1. Producto

Plataforma web para analistas de seguridad (SOC, SIEM users) que permite **explorar, clasificar y analizar logs** relevantes para detectar técnicas de **MITRE ATT&CK**.

**Diferencia clave con productos similares:** el centro de gravedad son los **logs**, no las técnicas. La mayoría de catálogos parten de ATT&CK y bajan a logs; aquí partimos de logs y subimos a ATT&CK.

**Casos de uso primarios:**
- Explorar logs por plataforma (Windows, Linux, macOS, SaaS, etc.).
- Identificar qué logs son útiles para qué detecciones.
- Analizar cobertura frente a MITRE ATT&CK.
- Detectar gaps de visibilidad en su SIEM.

**Usuario objetivo:** analista SOC con familiaridad con MITRE ATT&CK, fluido en terminología de logs (Event ID, Channel, Provider, Sysmon, EDR, CloudTrail, etc.). No es un usuario novato — la UX debe ser densa, rápida y respetar su tiempo.

**Alcance de esta aplicación:**
Esta plataforma **no procesa ni descarga datos de MITRE ATT&CK**. El procesamiento del dato vive en un **proyecto independiente** del equipo, que produce los datasets ya listos. Esta aplicación se limita a:
1. Ingerir esos datasets ya procesados en su base de datos.
2. Exponerlos al usuario con búsqueda, filtrado y exploración de alto rendimiento.
3. Permitir extraer/exportar subconjuntos de datos.

No hay sync con APIs externas de MITRE. No hay parsers de STIX. Si falta dato, se regenera en el proyecto upstream y se reingesta aquí.

---

## 2. Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) + TS | SSR/streaming, RSC para tablas pesadas |
| UI components | shadcn/ui + Tailwind | Componentes que viven en el repo, editables |
| Tabla principal | TanStack Table v8 | Virtualización, server-driven sort/filter |
| Data fetching | TanStack Query | Cache, revalidación, infinite scroll |
| Filtros en URL | nuqs | Compartir vistas filtradas entre analistas |
| Command palette | cmdk | Búsqueda global con autocomplete |
| Backend | FastAPI + Pydantic v2 | Ecosistema Python para MITRE/Sigma |
| ORM | SQLAlchemy 2.0 + Alembic | Standard maduro en Python |
| DB | PostgreSQL 16 | FTS, jsonb, fiable |
| Búsqueda | Meilisearch | Autocomplete instantáneo, faceted filters |
| Ingesta | Script CLI (Python) | Carga datasets ya procesados desde el proyecto upstream |
| Infra local | Docker Compose | Postgres + Meilisearch + api + web |
| Deploy | Vercel + Fly.io | Frontend en Vercel, resto en Fly |

---

## 3. Mapa del repo

```
log-intelligence/
├── apps/
│   ├── web/                  # Next.js 15
│   │   ├── src/app/          # Rutas
│   │   ├── src/components/
│   │   │   ├── ui/           # shadcn (no editar a mano)
│   │   │   ├── log-table/    # Tabla principal y celdas
│   │   │   ├── filters/      # Chips, dropdowns, command palette
│   │   │   └── platform/     # Tarjetas y selector de plataforma
│   │   ├── src/lib/
│   │   │   ├── api.ts        # Cliente HTTP tipado contra FastAPI
│   │   │   ├── types/        # Tipos espejo de los Pydantic schemas
│   │   │   └── search-params.ts # Schemas nuqs
│   │   └── src/hooks/
│   └── api/                  # FastAPI
│       ├── src/
│       │   ├── main.py
│       │   ├── routers/      # logs, techniques, platforms, search
│       │   ├── services/     # Lógica de dominio
│       │   ├── repositories/ # Acceso a DB
│       │   ├── models/       # SQLAlchemy
│       │   ├── schemas/      # Pydantic
│       │   ├── search/       # Cliente Meilisearch + indexers
│       │   └── ingest/       # CLI de ingesta (carga datasets upstream)
│       ├── alembic/
│       └── pyproject.toml
├── packages/
│   └── shared-types/         # (opcional) JSON Schema -> TS desde Pydantic
├── docker-compose.yml
├── ARCHITECTURE.md
├── CLAUDE.md
└── README.md
```

---

## 4. Convenciones de código

### TypeScript / Frontend
- `strict: true` siempre. Nada de `any` — usar `unknown` y narrowing.
- **Server Components por defecto**, `"use client"` solo cuando haya estado o handlers.
- Componentes en `PascalCase.tsx`, hooks `useThing.ts`, utils en `kebab-case.ts`.
- shadcn vive en `src/components/ui/` y **no se edita directamente**: se compone encima.
- Los tipos del backend se mirroran en `src/lib/types/`. Si añades un schema en Pydantic, añade su tipo TS en el mismo PR.
- Evita prop drilling: si pasa de 2 niveles, mueve a contexto local o a un hook.

### Python / Backend
- Python 3.12+. Type hints obligatorios.
- Pydantic v2 para todo lo que cruza la red.
- **Routers finos**: parsear input, llamar a un service, devolver schema. Nada de SQL en routers.
- **Repositories** envuelven SQLAlchemy. Los services no importan `Session` directamente.
- Migraciones Alembic, una por PR. Nombre descriptivo: `2026_05_09_add_log_provider_index.py`.
- Tablas en singular, `snake_case` (`log`, `technique`, `log_technique_mapping`).
- Errores HTTP: usar `HTTPException` con códigos correctos. Nunca devolver 200 con `{"error": ...}`.

### Git
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
- PRs pequeños, **vertical slices** (una feature end-to-end > un layer completo).
- Nunca commitear `.env`. Sí commitear `.env.example`.

---

## 5. Comandos clave

```bash
# Levantar todo en local
docker compose up -d            # postgres + meilisearch
pnpm --filter web dev           # next dev :3000
uv run --directory apps/api uvicorn src.main:app --reload  # api :8000

# Migraciones
uv run --directory apps/api alembic revision --autogenerate -m "descripcion"
uv run --directory apps/api alembic upgrade head

# Ingesta de un dataset producido por el proyecto upstream
uv run --directory apps/api python -m src.ingest.load --source path/o/url/al/dataset

# Reindexar Meilisearch
uv run --directory apps/api python -m src.search.reindex

# Lint / format
pnpm --filter web lint
pnpm --filter web typecheck
uv run --directory apps/api ruff check .
uv run --directory apps/api ruff format .
uv run --directory apps/api mypy src

# Tests
pnpm --filter web test
uv run --directory apps/api pytest
```

> Si añades un comando que vas a repetir, mételo aquí.

---

## 6. Decisiones arquitectónicas vivas

1. **La tabla principal es server-driven.** Filtros, sort y paginación viajan a la API. Nada de filtrar 50k+ filas en cliente.
2. **Filtros activos viven en la URL** (vía `nuqs`). Permite compartir vistas filtradas entre analistas — caso de uso real en SOC.
3. **El sistema de filtros es genérico/parametrizable.** Ni el frontend ni el backend hardcodean qué categorías existen. El backend expone qué se puede filtrar (vía `/filters/categories`) y el frontend lo renderiza dinámicamente. Esto permite añadir filtros nuevos sin cambiar el contrato API ni redeploy del frontend.
4. **El "modo comprimido" no es un filtro de frontend.** El backend devuelve la representación correcta según el contexto de filtros (jerarquía configurable). Ver `ARCHITECTURE.md` §4.
5. **El dato lo produce un proyecto upstream**, no esta app. Aquí solo ingerimos, almacenamos y servimos. Si falta o está mal un dato, se corrige upstream y se reingesta.
6. **Meilisearch indexa los logs.** Los atributos filtrables se configuran a partir de las categorías declaradas en metadata, no se hardcodean en código.
7. **Autenticación se aplaza** hasta tener producto validado. Endpoint público con rate-limit por IP por ahora.

---

## 7. Lo que NO hacer

- ❌ No introducir Material UI, Chakra, Mantine, Ant Design. Solo shadcn.
- ❌ No usar Prisma. Aquí el backend es Python: SQLAlchemy.
- ❌ No filtrar grandes datasets en cliente.
- ❌ No crear un wrapper "genérico" sobre TanStack Table. Componer directamente.
- ❌ **No procesar datos de MITRE aquí.** Ni descargas STIX, ni parseo, ni mapping logic. Eso vive upstream.
- ❌ **No hardcodear nombres de filtros** en el frontend. Las categorías se descubren del backend.
- ❌ No usar `useEffect` para fetch — usar TanStack Query o Server Components.
- ❌ No commitear secretos, tokens de API, ni dumps de logs reales de clientes.

---

## 8. Antes de empezar una tarea

1. Lee `ARCHITECTURE.md` para refrescar el modelo de datos y los flujos clave.
2. Si tocas la API: revisa los routers existentes en `apps/api/src/routers/`.
3. Si tocas la tabla: revisa `apps/web/src/components/log-table/` y los hooks en `src/hooks/`.
4. Para componentes nuevos de UI: `pnpm dlx shadcn@latest add <component>` **antes** de escribir desde cero.
5. Si la tarea afecta a contratos API ↔ web: actualiza Pydantic schema + tipo TS en el mismo PR.

---

## 9. Estado actual

- [ ] Scaffold de monorepo con `pnpm` workspaces y `uv`
- [ ] Docker Compose (postgres + meilisearch)
- [ ] Modelo de datos inicial + primera migración
- [ ] Acordar formato del dataset upstream (JSON / CSV / Parquet)
- [ ] CLI de ingesta (`src.ingest.load`)
- [ ] Endpoint `/filters/categories` (descubrimiento dinámico)
- [ ] Página de plataformas (landing)
- [ ] Tabla de logs con filtros server-driven
- [ ] Command palette + búsqueda global
- [ ] Toggle vista comprimida / completa
- [ ] Filtros sincronizados con URL
- [ ] Vista de cobertura
