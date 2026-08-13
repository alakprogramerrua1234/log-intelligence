# Arquitectura — Log Intelligence Platform

Documento vivo. Cualquier cambio estructural pasa primero por aquí.

---

## 1. Vista de alto nivel

```
┌─────────────────────┐
│  Proyecto upstream  │   (fuera de este repo)
│  (procesa MITRE +   │
│   produce dataset)  │
└──────────┬──────────┘
           │  CSV de detecciones
           ▼
┌──────────────────┐
│  CLI de ingesta  │  ──►  PostgreSQL  ──►  Meilisearch
│  (apps/api/src/  │       (source of      (índice de
│   ingest)        │        truth)          búsqueda)
└──────────────────┘
                                 ▲
                                 │
┌──────────────┐      HTTPS/JSON │
│  Next.js 15  │ ────────────────┴──► FastAPI ──► PG / Meilisearch
│  (Vercel)    │ ◄─────────────────── (Fly.io)
└──────────────┘
```

- **PostgreSQL** es la fuente de verdad dentro de esta app.
- **Meilisearch** es índice derivado, reconstruible en cualquier momento.
- **El dato lo produce un proyecto upstream del equipo**, no esta app. Aquí se ingiere mediante un CLI que valida y carga.

### 1.1 Unidades desplegables

El corte no es por capa técnica (front / api / db) sino por **ciclo de vida**:

| Unidad | Qué es | Por qué es una unidad propia |
|---|---|---|
| `web` | Next.js | Deploy y release propios (Vercel) |
| `api` | FastAPI sirviendo HTTP | Deploy propio (Fly). La DB es una **capa interna** suya, no una unidad aparte |
| `ingest` / `reindex` | Workers on-demand | Cadencia distinta (batch, disparado por upstream), fallos aislados del serving |

`apps/api/Dockerfile` produce las tres imágenes desde una base común: comparten modelos y repositorios, y lo que las separa es el comando, el ciclo de vida y el escalado. `tests/test_layering.py` verifica que `ingest/` y `search/` no importan la app HTTP, que es lo que hace real la separación.

> **La base de datos no es una tercera unidad desplegable.** El esquema y el código que lo consulta se versionan juntos: una migración de Alembic y el modelo que la usa van en el mismo PR. Lo que sí está aislado es el *acceso*: solo `repositories/` abre sesiones y ejecuta SQL, y eso se verifica en CI.

---

## 2. Modelo de datos

Esquema en estrella: **dimensiones** pequeñas (id autoincremental + `name`), una mini-jerarquía MITRE (`technique` / `subtechnique`) con PK textual igual al ID de ATT&CK, y una **tabla de hechos `detection`** que materializa cada fila del CSV de ingesta como la combinación de FKs hacia esas dimensiones.

### Dimensiones

Las cuatro tienen la misma forma: `id bigserial PK` + `name text UNIQUE`. La PK es el identificador estable interno; el `name` es lo que viaja por la red y aparece en la UI.

**`platform`** — Windows, Linux, macOS, AWS, Azure, GCP, Okta, M365, etc.
| Campo | Tipo | Notas |
|---|---|---|
| id   | bigserial PK | autoincremental |
| name | text UNIQUE  | "Windows", "AWS", "Okta" |

**`log_source`** — origen lógico (Sysmon, Windows Security, CloudTrail, Okta System Log, …).
| Campo | Tipo | Notas |
|---|---|---|
| id   | bigserial PK | |
| name | text UNIQUE  | "Sysmon", "Windows Security", "CloudTrail" |

**`channel`** — canal/stream técnico.
| Campo | Tipo | Notas |
|---|---|---|
| id   | bigserial PK | |
| name | text UNIQUE  | "Microsoft-Windows-Sysmon/Operational", "Security" |

**`tactic`** — táctica de MITRE ATT&CK.
| Campo | Tipo | Notas |
|---|---|---|
| id   | bigserial PK | |
| name | text UNIQUE  | "execution", "persistence", … |

### Mini-jerarquía MITRE

La PK de `technique` y `subtechnique` **no** es autoincremental: es el propio ID de ATT&CK. Esto hace que upserts e idempotencia sean triviales (el ID natural ya identifica la fila).

**`technique`**
| Campo | Tipo | Notas |
|---|---|---|
| id   | text PK | "T1059", "T1078" — ID de ATT&CK |
| name | text    | "Command and Scripting Interpreter" |

**`subtechnique`** — opcional. FK al `technique` padre.
| Campo | Tipo | Notas |
|---|---|---|
| id           | text PK                          | "T1059.001" |
| name         | text                             | "PowerShell" |
| technique_id | text FK → technique.id NOT NULL  | técnica padre |

> Ni `technique` ni `subtechnique` se descargan ni parsean aquí — vienen ya construidas en el CSV upstream.

### Tabla de hechos: `detection`

**Cada fila del CSV de ingesta produce una fila en `detection`.** Es la combinación de dimensiones + (sub)técnica que afirma "este log, en este canal, detecta esta técnica para esta táctica en esta plataforma".

| Campo            | Tipo                                  | Notas |
|---|---|---|
| id               | bigserial PK                          | autoincremental |
| platform_id      | bigint FK → platform.id     NOT NULL  | |
| log_source_id    | bigint FK → log_source.id   NOT NULL  | |
| channel_id       | bigint FK → channel.id      NOT NULL  | |
| tactic_id        | bigint FK → tactic.id       NOT NULL  | |
| technique_id     | text   FK → technique.id    NOT NULL  | |
| subtechnique_id  | text   FK → subtechnique.id NULL      | sin subtécnica = NULL |
| created_at       | timestamptz                           | timestamp local de ingesta |

**Constraint de unicidad** (la clave de la idempotencia del ingest — sin esto, reejecutar la carga duplicaría todo):

```sql
UNIQUE NULLS NOT DISTINCT
  (platform_id, log_source_id, channel_id, tactic_id, technique_id, subtechnique_id)
```

> `NULLS NOT DISTINCT` (PostgreSQL 15+) es necesario porque, por defecto, Postgres considera dos `NULL` distintos en un `UNIQUE`. Sin esa cláusula, dos filas con la misma combinación pero `subtechnique_id = NULL` se duplicarían.

### `filter_category` — qué se puede filtrar

Catálogo dinámico. Cada categoría apunta a una **tabla** (dimensión, `technique` o `subtechnique`) de donde se obtienen sus valores y a la FK que usa para filtrar la tabla de hechos.

| Campo         | Tipo     | Notas |
|---|---|---|
| key           | text PK  | identificador estable: `platform`, `log_source`, `channel`, `tactic`, `technique`, `subtechnique` |
| label         | text     | nombre legible para la UI (i18n a futuro) |
| source_table  | text     | tabla de origen: `platform`, `log_source`, `channel`, `tactic`, `technique`, `subtechnique` |
| value_column  | text     | columna a mostrar al usuario (`name` para dimensiones; `id` o `name` para technique/subtechnique) |
| detection_fk  | text     | columna de `detection` por la que se filtra: `platform_id`, `log_source_id`, `channel_id`, `tactic_id`, `technique_id`, `subtechnique_id` |
| value_type    | text     | `string`, `enum`, `number` |
| ui_hint       | text     | `dropdown`, `multiselect`, `text`, `chip` |
| order         | smallint | orden sugerido en UI |
| enabled       | boolean  | apagar sin borrar |

**Cómo se usa:**
1. El frontend pide `/filters/categories` y renderiza chips/dropdowns dinámicamente.
2. La API recibe `filter[<key>]=<value>`, valida `key` contra el catálogo habilitado y filtra `detection` por la columna del binding correspondiente. Una clave desconocida devuelve **`400 unknown_filter_category`** — nunca `200` con la tabla sin filtrar.
3. **Los strings de esta tabla no se convierten en SQL.** Solo *seleccionan* un binding tipado del registro `apps/api/src/repositories/bindings.py` (`FILTERABLE`). Construir SQL a partir de datos de la DB sería superficie de inyección y perdería el tipado de SQLAlchemy.

**Consistencia DB ↔ código.** `services/filters.py::validate_catalog` cruza ambos lados al arrancar la API: si una categoría habilitada no tiene binding, o declara una `source_table` / `value_column` / `detection_fk` distinta a la del binding, **la app no arranca**. Sin esa comprobación el mismo error se manifestaría en producción como filtros ignorados en silencio, que es invisible. `tests/test_filters_unit.py` lo verifica también contra el seed real, para detectar la deriva en CI antes que en boot.

**Qué cuesta añadir o cambiar un filtro:**

| Cambio | Coste |
|---|---|
| Reordenar, renombrar `label`, cambiar `ui_hint`, apagar/encender | `UPDATE` en la DB. Sin deploy. |
| Categoría nueva sobre una dimensión que ya existe | Fila nueva. Sin deploy. |
| Dimensión nueva | Migración + modelo + una línea en `FILTERABLE`. |

En los tres casos: **cero cambios en el frontend.**

### Índices clave

- Cada dimensión: el `UNIQUE(name)` ya implica índice.
- `subtechnique(technique_id)` para navegar la jerarquía.
- `detection`: el `UNIQUE NULLS NOT DISTINCT` cubre el lookup por combinación completa. Añadir índices simples por cada FK (`detection(platform_id)`, `detection(log_source_id)`, `detection(channel_id)`, `detection(tactic_id)`, `detection(technique_id)`, `detection(subtechnique_id)`) para los filtros más comunes.

### Diagrama

```
platform ────┐
log_source ──┤
channel ─────┼──► detection ◄── technique ◄── subtechnique
tactic ──────┘
```

---

## 3. Endpoints API

Base: `/api/v1`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/platforms` | Lista de plataformas con conteo de logs |
| GET | `/platforms/{slug}` | Detalle de plataforma + log_sources |
| GET | `/filters/categories` | **Discovery**. Devuelve qué categorías de filtro existen, su tipo y `ui_hint`. El frontend se construye a partir de esto. |
| GET | `/logs` | **El endpoint clave**. Filtros genéricos: ver §3.1. |
| GET | `/logs/{id}` | Detalle con técnicas asociadas |
| GET | `/techniques` | Catálogo de técnicas filtrable |
| GET | `/techniques/{id}` | Detalle + logs que la detectan |
| GET | `/search/suggest` | Autocomplete por categoría: `?category=<key>&q=<texto>` |
| GET | `/coverage` | Matriz de cobertura según logs seleccionados |
| POST | `/admin/reindex` | Trigger reindex Meilisearch (auth admin) |

### 3.1 Filtros genéricos en `/logs`

El contrato de filtros es **dinámico**. La sintaxis aceptada:

```
GET /logs?filter[<category_key>]=<value>&filter[<category_key>]=<value>&q=<texto>&view=compact&sort=<field>&cursor=<c>&limit=50
```

- `category_key` es una clave declarada en `filter_category`. La API rechaza claves desconocidas con `400`.
- Multi-valor por repetición: `?filter[tactic]=execution&filter[tactic]=persistence` (semántica OR dentro de la misma categoría, AND entre categorías distintas).
- `q` es texto libre (Meilisearch).
- `view` es `compact` o `full`.

> **Por qué genérico:** las categorías de filtrado todavía no están cerradas. Esta forma permite añadir/quitar filtros tocando solo `filter_category` + indexación, sin redeploy del frontend.

**Convenciones de respuesta:**
- Listas paginadas devuelven `{ items: [...], next_cursor: "...", total: 1234 }`.
- **Cursor-based, no offset.** El cursor es **opaco** (base64 de `{k, v}`): el cliente lo reenvía tal cual y nunca lo construye. Esa opacidad es lo que permite que Postgres pagine por keyset sobre `detection.id` y Meilisearch por número de página, detrás del mismo contrato. Un cursor del backend equivocado se rechaza con `400 invalid_cursor` en vez de interpretarse mal.
- Errores con la forma de `schemas/errors.py::ErrorOut` — `{ "detail": "...", "code": "log_not_found", "keys": [] }`. El cliente ramifica sobre `code`, nunca sobre `detail`. El tipo espejo es `ApiErrorBody` en `apps/web/src/lib/types/`.
- Todo endpoint que devuelva listas acepta `limit` acotado. Nada sin techo.

---

## 4. Flujo crítico: tabla de logs

Esta es la pieza con más lógica. Vale la pena documentarla en detalle porque es donde el blueprint del Figma vive de verdad.

### 4.1 Vista comprimida vs completa

El blueprint pide dos modos:
- **Comprimida**: muestra solo hasta el "siguiente nivel relevante" según los filtros activos.
- **Completa**: muestra toda la información, incluyendo técnicas.

**Decisión:** la lógica de qué es "relevante" vive en el backend. El parámetro `view=compact` cambia la query y la forma de la respuesta.

La jerarquía concreta no se hardcodea en el código del frontend. Vive en una config del backend (por ejemplo `apps/api/src/config/hierarchy.py`) que enumera el orden de drill-down esperado, p. ej.:

```
[ "platform", "log_source", "channel", "tactic", "technique", "subtechnique" ]
```

Reglas generales de la vista comprimida (independientes del orden concreto, que es config):

| Estado de filtros | Resultado en vista comprimida |
|---|---|
| Sin filtros | Una fila por valor del primer nivel jerárquico, con conteos |
| Filtros aplicados hasta el nivel N | Una fila por valor único del nivel N+1, sin colapsar más allá |
| Filtros que ya determinan el nivel hoja (ej. técnica seleccionada) | Auto-expande a vista completa |

La vista completa siempre devuelve la fila atómica.

> Si más adelante cambia el orden jerárquico, se cambia la config. El código de la tabla y de la API no se tocan.

### 4.2 Filtros y URL

Los filtros se serializan en la URL vía `nuqs`. Esquema **genérico**:

```
/explore?f.<categoryKey>=valor&f.<categoryKey>=otro&q=process&view=compact
```

Ejemplos (las claves concretas dependen de lo que devuelva `/filters/categories`):

```
/explore?f.platform=windows&f.log_source=sysmon&q=process&view=compact
/explore?f.something=x&f.other=y                      # mañana podemos añadir categorías sin tocar código
```

Cada categoría puede aparecer múltiples veces para multi-selección: `?f.tactic=execution&f.tactic=persistence`.

**Implementación frontend:** un único schema de `nuqs` que parsea cualquier `f.*` como arrays de strings, sin enumerar las claves. Las claves válidas se validan contra `/filters/categories` cuando se renderizan los chips/dropdowns.

**Por qué URL y no solo state:** un analista que encuentra un patrón puede pegar la URL en Slack del SOC y el resto la abre con la misma vista exacta.

### 4.3 Búsqueda global (command palette)

Componente `cmdk` con dos modos:
1. **Búsqueda libre** (`q=...`) → llama `/logs?q=...`, ranking de Meilisearch.
2. **Filtrado por categoría** → al escribir `<categoryKey>:` o seleccionar la categoría desde el menú, llama `/search/suggest?category=<categoryKey>&q=...` y muestra valores.

El menú de categorías se construye dinámicamente desde `/filters/categories` (cacheado en cliente vía TanStack Query). Añadir una categoría nueva en el backend hace que aparezca automáticamente en el palette tras la próxima revalidación.

Al confirmar un valor → se añade como chip (filtro activo) y la URL se actualiza.

### 4.4 Click en cabecera de columna

Decisión del blueprint: clicar el nombre de una columna abre el command palette **con esa categoría preseleccionada**. Implementación: el componente de cabecera dispara `openCommandPalette({ category: column.id })`. El `column.id` debe coincidir con un `category_key` declarado en `filter_category` para que el palette tenga sugerencias.

### 4.5 Hierarchical drill-down

El sistema jerárquico se implementa en el endpoint `/logs` consultando la config de jerarquía (§4.1) y los filtros activos. El frontend solo renderiza filas; no decide jerarquía.

---

## 5. Búsqueda

### 5.1 El seam: `SearchBackend`

La búsqueda vive detrás de un contrato de un solo método (`apps/api/src/search/backend.py`):

```python
def search(q, filters, limit, cursor) -> SearchPage   # ids, total, next_cursor
```

**Devuelve ids, no filas.** Hidratar es cosa de `DetectionRepository`. Ese seam estrecho es lo que permite dos implementaciones sin que ninguna conozca la forma de la respuesta HTTP ni los joins:

| Backend | Orden | Paginación | Cuándo |
|---|---|---|---|
| `PostgresSearchBackend` | `detection.id` | keyset (`id > cursor`) | **default**; la app arranca sin Meilisearch |
| `MeilisearchBackend` | relevancia | página (`hitsPerPage`) | requiere haber reindexado |

Se elige con `SEARCH_BACKEND=postgres|meilisearch`. El coste de la abstracción es una query extra (ids → hidratar); a cambio, cambiar de motor no toca routers, services ni el contrato.

### 5.2 Índice `detections`

Documento aplanado por fila de `detection`, con los joins ya resueltos. **Se deriva del catálogo**, no se escribe a mano: el atributo con el nombre de la categoría lleva el *valor filtrable* (el que viaja en `filter[<key>]=`), y el nombre legible va en `<key>_name` solo cuando difiere.

```json
{
  "id": 184213,
  "platform": "Windows",
  "log_source": "Sysmon",
  "event_id": "1",
  "tactic": "execution",
  "technique": "T1059",
  "technique_name": "Command and Scripting Interpreter",
  "subtechnique": "T1059.001",
  "subtechnique_name": "PowerShell"
}
```

**Atributos (nunca hardcodeados):**
- `filterableAttributes` → las `key` habilitadas en `filter_category`.
- `searchableAttributes` → las mismas, **en el orden de `filter_category.order`**. En Meilisearch ese orden *es* la prioridad de ranking, así que la columna `order` hace doble función: ordena los filtros en la UI y pesa la búsqueda.

> Esto sustituye al `config.yaml` de pesos que contemplaba el plan original. Una sola declaración en la DB en vez de dos fuentes que se pueden contradecir, y sin dependencia de YAML.

**Reindex:**
- `python -m src.search.reindex` (o `docker compose run --rm reindex`).
- Automático al final de una ingesta con éxito, si `SEARCH_BACKEND=meilisearch`. Si falla, la carga ya está confirmada y el CLI lo dice explícitamente antes de salir con error — el índice es derivado y se reconstruye.
- Idempotente: `PUT` de documentos por clave primaria.

> **Sin verificar contra un Meilisearch real.** Lo que está cubierto por tests es lo nuestro: expresión de filtro, escapado de valores, cursores, forma del documento y atributos derivados. El contrato de red con Meilisearch (incluida la sensibilidad a mayúsculas de sus filtros, que en Postgres es explícitamente insensible) necesita una pasada contra el contenedor antes de poner `SEARCH_BACKEND=meilisearch` en producción.

---

## 6. Ingesta del dataset upstream

Esta app **no procesa** datos de MITRE ni hace mapping logic. Recibe un **CSV de detecciones** ya construido por un proyecto independiente del equipo, y lo carga en la tabla de hechos `detection`.

**Formato del CSV** — una fila por detección, las siguientes columnas (orden estable, cabecera obligatoria):

| Columna           | Obligatoria | Notas |
|---|---|---|
| platform          | sí | nombre legible. Se upserta en `platform.name`. |
| log_source        | sí | se upserta en `log_source.name`. |
| channel           | sí | se upserta en `channel.name`. |
| tactic            | sí | se upserta en `tactic.name`. |
| technique_id      | sí | ID de ATT&CK ("T1059"). Upsert en `technique`. |
| technique_name    | sí | nombre legible de la técnica. |
| subtechnique_id   | no | ID de ATT&CK ("T1059.001") o vacío. |
| subtechnique_name | no | nombre de la subtécnica si aplica. |

**Una fila del CSV → una fila en `detection`.** El `UNIQUE NULLS NOT DISTINCT` deduplica al cargar: reejecutar la misma ingesta es no-op.

**CLI:**
```
python -m src.ingest.load --source <ruta-al-csv> [--dry-run]
```

**Pasos del CLI:**
1. **Leer** el CSV en streaming (no cargar todo en memoria).
2. **Validar** cada fila contra un Pydantic schema en `apps/api/src/ingest/schemas.py`. Falla rápido si hay columnas faltantes o tipos mal.
3. **Upsert de dimensiones** (`platform`, `log_source`, `channel`, `tactic`) por `name` para obtener el `id`. Cachear en memoria los `name → id` para no repetir queries.
4. **Upsert de `technique`** por PK natural: `INSERT ... ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`.
5. **Upsert de `subtechnique`** con el mismo patrón + FK `technique_id`. Columna vacía en el CSV ⇒ `NULL` en `detection.subtechnique_id` (no se crea fila en `subtechnique`).
6. **Insert en `detection`** con `INSERT ... ON CONFLICT DO NOTHING` apoyado en el `UNIQUE` sobre la combinación completa de FKs. Las filas duplicadas se descartan silenciosamente.
7. **Sincronizar `filter_category`** (seed inicial — apuntando cada categoría a su `source_table` y `detection_fk`). Se mantiene estable después.
8. **Reindexar Meilisearch** al final.
9. **Reportar** al stdout: filas leídas, dimensiones nuevas insertadas por tabla, detections insertadas vs duplicadas, duración.

**Idempotencia:** correr la misma ingesta dos veces deja la DB idéntica. No hace falta truncar.

**Frecuencia:** manual / on-demand. No hay cron automático: cuando upstream publica un CSV nuevo, alguien dispara la ingesta.

---

## 7. Frontend: estructura de componentes clave

```
log-table/
├── LogTable.tsx              # Server Component, fetch inicial
├── LogTableClient.tsx        # "use client", maneja interacciones
├── columns.ts                # Definiciones TanStack
├── ViewToggle.tsx            # Compact / Full
└── cells/
    ├── PlatformCell.tsx
    ├── TechniqueCell.tsx     # Chips clicables
    └── EventIdCell.tsx

filters/
├── CommandPalette.tsx        # cmdk
├── FilterChips.tsx           # Filtros activos visibles
├── CategoryDropdown.tsx
└── filter-state.ts           # Schemas nuqs
```

---

## 8. Decisiones aplazadas (parking lot)

- Autenticación y multi-tenancy.
- Subir mappings propios del usuario (su SIEM detecta X event ID con Y query).
- Integraciones (Splunk, Elastic, Sentinel) para auto-coverage.
- Versionado de datasets en DB (poder volver a una versión anterior sin reingestar).
- Diff visual entre dos versiones del dataset upstream.
- API pública con rate-limit por API key.
- Acordar formato exacto del dataset upstream con el equipo del proyecto que lo produce.
