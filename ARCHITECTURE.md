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
2. Cuando el usuario selecciona valores, la API recibe `filter[<key>]=<name>`, resuelve `name → id` contra `source_table.value_column` y filtra `detection` por `detection_fk`.
3. Añadir un filtro nuevo = insertar una fila aquí (apuntando a una dimensión ya existente). **Cero cambios en el frontend.**

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
- Cursor-based, no offset (los datasets crecen y la paginación por offset duele).
- Errores con `{ "detail": "...", "code": "log_not_found" }`.

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

## 5. Búsqueda con Meilisearch

**Índices:**
- `detections`: documento aplanado por fila de `detection` con las dimensiones ya resueltas (joins materializados al indexar) y los campos potencialmente filtrables/searchable.
- `techniques`: documentos por técnica.

**Atributos configurables (no hardcodear):**
- `filterableAttributes` en `detections` → se calcula a partir de `filter_category` (los `key` declarados ahí).
- `searchableAttributes` y sus pesos → leídos de un YAML de config (`apps/api/src/search/config.yaml`) para no requerir cambios de código al añadir un campo.

**Reindex:**
- Job manual vía endpoint admin (`POST /admin/reindex`).
- Triggered automáticamente al final de cada ingesta (`src.ingest.load`).
- En desarrollo: re-ejecutar el comando es la forma estándar de refrescar.

**Documento de `detection` en Meilisearch (joins ya resueltos al indexar):**

```json
{
  "id": 184213,
  "platform": "Windows",
  "log_source": "Sysmon",
  "channel": "Microsoft-Windows-Sysmon/Operational",
  "tactic": "execution",
  "technique_id": "T1059",
  "technique_name": "Command and Scripting Interpreter",
  "subtechnique_id": "T1059.001",
  "subtechnique_name": "PowerShell"
}
```

> Los nombres de los atributos filtrables siguen las `key` de `filter_category`. Si se añade una dimensión nueva, se añade una fila a `filter_category` y se ajusta el indexer; el frontend no necesita saberlos por nombre.

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
