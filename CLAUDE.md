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

**Las tres vistas del producto** (y su estado — detalle en `ARCHITECTURE.md` §8.3):

| Vista | Qué es | Estado |
|---|---|---|
| **Explore logs** | Listado de logs mapeados a técnicas/tácticas, con filtros y búsqueda | Funcional contra datos reales |
| **Exploit your log** | Detalle por log: configuración, campos útiles, reglas públicas (Sigma…) | Solo UI mock. El dataset se produce aparte y traerá **tablas propias** |
| **Ranking** | Los logs más útiles para detección, global y por plataforma | Sin implementar; depende del score |

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
| Frontend framework | Next.js 16 (App Router) + TS | SSR/streaming, RSC para tablas pesadas |
| UI components | shadcn/ui + Tailwind | Componentes que viven en el repo, editables |
| Tabla principal | TanStack Table v8 + TanStack Virtual | Virtualización real de filas, server-driven sort/filter |
| Data fetching | TanStack Query | Cache, revalidación, infinite scroll |
| Filtros en URL | History API + store propio (`src/lib/url-state.ts`) | Claves `f.*` descubiertas en runtime — incompatible con la API de `nuqs`, que exige declararlas en compilación |
| Command palette | cmdk | Búsqueda global con autocomplete |
| Backend | FastAPI + Pydantic v2 | Ecosistema Python para MITRE/Sigma |
| ORM | SQLAlchemy 2.0 + Alembic | Standard maduro en Python |
| DB | PostgreSQL 16 | FTS, jsonb, fiable |
| Búsqueda | Postgres (`LIKE`), tras el seam `SearchBackend` | Sin motor de búsqueda aparte: el volumen no lo pide. Ver `ARCHITECTURE.md` §5 |
| Ingesta | Script CLI (Python) | Carga datasets ya procesados desde el proyecto upstream |
| Infra local | Docker Compose | postgres (+ api e ingest tras un profile) |
| Deploy | Vercel + Fly.io | Frontend en Vercel, resto en Fly |
| CI | GitHub Actions | Lint, mypy strict, 130 tests con Postgres real, OpenAPI y tipos TS al día, build de web |

---

## 3. Mapa del repo

```
log-intelligence/
├── apps/
│   ├── web/                  # Next.js 16
│   │   ├── src/app/          # /, /explore, /exploit, /exploit/[slug]
│   │   ├── src/components/
│   │   │   ├── log-table/    # Tabla virtualizada, columnas y celdas
│   │   │   ├── filters/      # Chips, command palette
│   │   │   ├── platform/     # Sidebar de plataformas
│   │   │   └── layout/       # Header, theme toggle
│   │   ├── src/lib/
│   │   │   ├── api.ts        # Cliente HTTP tipado + ApiError con `code`
│   │   │   ├── url-state.ts  # Dueño único de los search params (filtros, q, view)
│   │   │   ├── types/        # api.generated.ts (del OpenAPI) + index.ts
│   │   │   ├── mock-data.ts  # Mock de logs — lo usa la landing (Top logs)
│   │   │   └── exploit-mock.ts # Mock de la vista Exploit, entera
│   │   ├── src/hooks/
│   │   └── scripts/          # generate:types / check:types
│   └── api/                  # FastAPI
│       ├── src/
│       │   ├── main.py           # app, exception handlers, validate_catalog al arrancar
│       │   ├── dependencies.py   # composition root — el único que ve la Session fuera de repositories/
│       │   ├── routers/          # logs, filters
│       │   ├── services/         # Lógica de dominio (sin SQLAlchemy)
│       │   ├── repositories/     # Acceso a DB + bindings tipados de filtros/orden
│       │   ├── models/           # SQLAlchemy
│       │   ├── schemas/          # Pydantic
│       │   ├── search/           # Seam SearchBackend (Postgres) + cursores opacos
│       │   └── ingest/           # CLI de ingesta (carga datasets upstream)
│       ├── tests/            # 130 tests, incluidos guardarraíles de capas
│       ├── alembic/
│       ├── openapi.json      # Exportado; CI falla si está desactualizado
│       └── pyproject.toml
├── .github/workflows/ci.yml
├── data/                     # sample.csv versionado; datasets reales en .gitignore
├── docker-compose.yml
├── ARCHITECTURE.md
├── CLAUDE.md
└── README.md
```

> No hay `packages/shared-types` ni `src/components/ui`: los tipos compartidos se generan del OpenAPI, y todavía no se ha instalado ningún componente de shadcn.

---

## 4. Convenciones de código

### TypeScript / Frontend
- `strict: true` siempre. Nada de `any` — usar `unknown` y narrowing.
- **Server Components por defecto**, `"use client"` solo cuando haya estado o handlers.
- Componentes en `PascalCase.tsx`, hooks `useThing.ts`, utils en `kebab-case.ts`.
- Si se instala shadcn, vive en `src/components/ui/` y **no se edita directamente**: se compone encima. Hoy no hay ninguno instalado.
- Los tipos del contrato **se generan, no se escriben**: `src/lib/types/api.generated.ts` sale del OpenAPI y `index.ts` solo re-exporta. Cambiar un schema Pydantic sin regenerar rompe CI.
- Evita prop drilling: si pasa de 2 niveles, mueve a contexto local o a un hook.
- En la tabla, las celdas **no montan hooks**: lo que necesitan viaja por `table.options.meta`. Con 200 filas × 8 columnas, un hook por celda son más de mil instancias y fue una de las causas del congelado de `/explore`.

### Python / Backend
- Python 3.12+. Type hints obligatorios.
- Pydantic v2 para todo lo que cruza la red.
- **Routers finos**: parsear input, llamar a un service, devolver schema. Nada de SQL en routers.
- **Repositories** envuelven SQLAlchemy. Los services no importan `Session` directamente.
- Estas dos reglas **están verificadas en CI** por `apps/api/tests/test_layering.py`: `routers/` y `services/` no pueden importar `sqlalchemy` ni usar `Session` / `get_db` / `.execute(`. La única excepción es `src/dependencies.py`, el composition root.
- Migraciones Alembic, una por PR. Nombre descriptivo: `2026_05_09_add_log_provider_index.py`.
- Tablas en singular, `snake_case` (dimensiones: `platform`, `log_source`, `event_id`, `tactic`; jerarquía MITRE: `technique`, `subtechnique`; hechos: `detection`).
- Errores HTTP: usar `HTTPException` con códigos correctos. Nunca devolver 200 con `{"error": ...}`.

### Git
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
- PRs pequeños, **vertical slices** (una feature end-to-end > un layer completo).
- Nunca commitear `.env`. Sí commitear `.env.example`.

---

## 5. Comandos clave

```bash
# Levantar todo en local
docker compose up -d postgres   # basta con Postgres: el backend de búsqueda por defecto es él
pnpm --filter web dev           # next dev :3000
uv run --directory apps/api uvicorn src.main:app --reload --port 8001  # api :8001

# Cargar el dataset de Explore
uv run --directory apps/api python -m src.ingest.load --source data/log_technique_map.csv

# Migraciones
uv run --directory apps/api alembic revision --autogenerate -m "descripcion"
uv run --directory apps/api alembic upgrade head

# Ingesta de un dataset producido por el proyecto upstream
uv run --directory apps/api python -m src.ingest.load --source path/al/dataset [--dry-run]

# Contrato API -> web: exportar OpenAPI y regenerar los tipos TS.
# Los dos van juntos y en el mismo PR; CI falla si el generado no coincide.
uv run --directory apps/api python scripts/export_openapi.py
pnpm --filter web generate:types
pnpm --filter web check:types

# Build de la demo estática (sin backend, datos de mock-data.ts)
NEXT_OUTPUT_EXPORT=true NEXT_PUBLIC_USE_MOCK=true pnpm --filter web build   # -> apps/web/out

# Lint / format
pnpm --filter web lint
pnpm --filter web typecheck
uv run --directory apps/api ruff check .
uv run --directory apps/api ruff format .
uv run --directory apps/api mypy src

# Tests (solo backend — el frontend todavía no tiene runner de tests)
uv run --directory apps/api pytest

# Los tests de ingesta necesitan Postgres de verdad (ON CONFLICT,
# UNIQUE NULLS NOT DISTINCT). Sin TEST_DATABASE_URL se saltan.
#
# ⚠ Apunta a `logintel_test`, NUNCA a `logintel`: el fixture hace drop_all() y
#   se llevaría por delante el dataset ingerido. La suite aborta si el nombre de
#   la base no contiene "test".
docker compose up -d postgres
docker exec logintel-postgres createdb -U logintel logintel_test   # solo la primera vez
TEST_DATABASE_URL=postgresql+psycopg://logintel:logintel@localhost:5432/logintel_test \
  uv run --directory apps/api pytest
```

> Si añades un comando que vas a repetir, mételo aquí.

---

## 6. Decisiones arquitectónicas vivas

1. **La tabla principal es server-driven.** Filtros, sort y paginación viajan a la API. Nada de filtrar 50k+ filas en cliente.
2. **Filtros activos viven en la URL** (vía `src/lib/url-state.ts`, no `nuqs` — su API exige declarar las claves en compilación, incompatible con categorías `f.*` descubiertas en runtime). Permite compartir vistas filtradas entre analistas — caso de uso real en SOC. Ver `ARCHITECTURE.md` §4.2.
3. **El sistema de filtros es genérico/parametrizable.** Ni el frontend ni el backend hardcodean qué categorías existen. El backend expone qué se puede filtrar (vía `/filters/categories`) y el frontend lo renderiza dinámicamente. Esto permite añadir filtros nuevos sin cambiar el contrato API ni redeploy del frontend.
4. **El "modo comprimido" está sin resolver.** Hoy solo oculta dos columnas en el cliente, y el `view` que el frontend envía la API lo ignora. La propuesta es que cambie la *granularidad* (una fila por log vs. una por mapping), no las columnas. **Decisión abierta** — ver `ARCHITECTURE.md` §4.1. No construyas encima del comportamiento actual sin resolverla.
5. **El dato lo produce un proyecto upstream**, no esta app. Aquí solo ingerimos, almacenamos y servimos. Si falta o está mal un dato, se corrige upstream y se reingesta. Los datasets de "Exploit your log" llegarán aparte y con **sus propias tablas**; no los modeles por adelantado.
6. **La búsqueda la resuelve Postgres, y no hay motor aparte.** Hubo un backend de Meilisearch completo y se retiró: estaba apagado por defecto y nunca se ejecutó contra una instancia real. Si `q` se vuelve lento, el siguiente paso es un índice GIN con `pg_trgm`, no un servicio nuevo. Ver `ARCHITECTURE.md` §5.
7. **Autenticación se aplaza** hasta tener producto validado. Endpoint público con rate-limit por IP por ahora.
8. **La búsqueda vive tras `SearchBackend`** (`apps/api/src/search/`) aunque solo haya una implementación: ahí es donde vive la paginación por cursor, y sustituir el motor debe ser cambiar una función del composition root y nada más.
9. **Los cursores de paginación son opacos.** El cliente los reenvía, nunca los construye. Es lo que permite que cada backend pagine a su manera sin romper el contrato.
10. **Los tipos TS del contrato se generan**, no se escriben. `apps/web/src/lib/types/api.generated.ts` sale del OpenAPI; `index.ts` solo re-exporta y declara lo que aún no existe en la API.
11. **Las unidades desplegables se cortan por ciclo de vida** (web / api / workers), no por capa técnica. La DB es una capa interna de la api. Ver `ARCHITECTURE.md` §1.1.

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
5. Si la tarea afecta a contratos API ↔ web: cambia el schema de Pydantic y **regenera** — `python scripts/export_openapi.py` + `pnpm --filter web generate:types` — en el mismo PR. Los tipos TS ya no se escriben a mano; CI falla si el generado no coincide.

---

## 9. Estado actual

**Hecho:**
- [x] Scaffold de monorepo con `pnpm` workspaces y `uv`
- [x] Docker Compose (postgres; api e ingest tras un profile)
- [x] Modelo de datos + migraciones
- [x] Formato del dataset de Explore acordado de facto (CSV, ver `ARCHITECTURE.md` §6)
- [x] CLI de ingesta idempotente (`src.ingest.load`)
- [x] `/filters/categories`, `/filters/values`, `/filters/suggest`
- [x] `/logs` con filtros dinámicos, orden y paginación por cursor opaco
- [x] Tabla de logs virtualizada, server-driven, con filtros en URL
- [x] Command palette (búsqueda libre + por categoría) y celdas filtrables
- [x] Separación de capas verificada en CI + 130 tests
- [x] Tipos TS generados desde el OpenAPI, comprobados en CI

**Pendiente:**
- [ ] Resolver la granularidad de Explore (§4.1 de `ARCHITECTURE.md`)
- [ ] Score real — hoy `relevance` es `0` fijo y la landing usa mock
- [ ] Vista **Ranking** (depende del score)
- [ ] Vista **Exploit your log** contra datos reales (dataset en producción aparte)
- [ ] Endpoint `/platforms` — la landing usa un catálogo mock cuyos slugs **no existen** en el dataset: 8 de sus 11 enlaces llevan a una tabla vacía
- [ ] Vista de cobertura
