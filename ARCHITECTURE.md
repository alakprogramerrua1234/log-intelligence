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
           │  dataset listo (JSON/CSV/Parquet)
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

Tres entidades core, una pivote, y catálogos.

### Entidades

**`platform`** — Windows, Linux, macOS, AWS, Azure, GCP, Okta, M365, etc.
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| slug | text UNIQUE | `windows`, `linux`, `aws` |
| name | text | "Microsoft Windows" |
| category | text | `os`, `cloud`, `saas`, `network` |
| icon | text | clave para asset estático |

**`log_source`** — agrupa logs por origen lógico (Sysmon, Security, CloudTrail, Okta System Log, etc.)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| platform_id | uuid FK → platform | |
| name | text | "Sysmon", "Windows Security" |
| description | text | |
| collection_method | text[] | `agent`, `wef`, `api`, `syslog` |

**`log`** — el evento concreto. La fila central de la app.
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| log_source_id | uuid FK → log_source | |
| channel | text | "Microsoft-Windows-Sysmon/Operational" |
| event_id | text | "1", "4624". Texto porque algunas plataformas no son numéricas. |
| provider | text | "Microsoft-Windows-Sysmon" |
| name | text | "Process Creation" |
| description | text | |
| sample_fields | jsonb | ejemplo de payload |
| relevance | smallint | 0–100, calculado: cuántas técnicas detecta + criticidad |
| created_at | timestamptz | |

**`technique`** — técnicas de MITRE tal como las recibimos del proyecto upstream (no las descargamos ni parseamos aquí).
| Campo | Tipo | Notas |
|---|---|---|
| id | text PK | "T1059.001" (lo asigna upstream) |
| name | text | |
| tactic | text[] | una técnica puede vivir en múltiples tácticas |
| description | text | |
| url | text | enlace a attack.mitre.org (lo provee upstream) |
| dataset_version | text | versión del dataset upstream del que vino esta fila |

**`log_technique_mapping`** — la pivote rica. Llega ya hecha desde upstream.
| Campo | Tipo | Notas |
|---|---|---|
| log_id | uuid FK → log | PK compuesta |
| technique_id | text FK → technique | PK compuesta |
| confidence | smallint | 0–100, viene de upstream |
| notes | text | razonamiento (viene de upstream) |
| dataset_version | text | versión del dataset que produjo este mapping |
| created_at | timestamptz | timestamp de la ingesta local |

**`filter_category`** — descubrimiento dinámico de qué se puede filtrar.
| Campo | Tipo | Notas |
|---|---|---|
| key | text PK | identificador estable: `platform`, `log_source`, `event_id`, `tactic`, etc. |
| label | text | nombre legible para la UI (i18n a futuro) |
| field_path | text | de dónde sale el valor (ej. `log.channel`, `mapping.technique.tactic`) |
| value_type | text | `string`, `enum`, `number` |
| ui_hint | text | `dropdown`, `multiselect`, `text`, `chip` |
| order | smallint | orden sugerido en UI |
| enabled | boolean | apagar sin borrar |

> Esta tabla es la fuente de verdad de **qué filtros existen**. Se popula por el CLI de ingesta (a partir de la metadata del dataset upstream) o por seed. El frontend pregunta `/filters/categories` y se autoconfigura.

### Índices clave

- `log(log_source_id)`, `log(channel, event_id)` UNIQUE
- `log_technique_mapping(technique_id)` para query inversa
- GIN sobre `log.sample_fields` y `log.description tsvector`

### Diagrama

```
platform 1───* log_source 1───* log *───* technique
                                   (log_technique_mapping)
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
[ "platform", "log_source", "log", "technique" ]
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
- `logs`: documento aplanado por log con todos los campos potencialmente filtrables/searchable.
- `techniques`: documentos por técnica.

**Atributos configurables (no hardcodear):**
- `filterableAttributes` en `logs` → se calcula a partir de `filter_category` (los `field_path` declarados que apunten a campos del log o de relaciones planas).
- `searchableAttributes` y sus pesos → leídos de un YAML de config (`apps/api/src/search/config.yaml`) para no requerir cambios de código al añadir un campo.

**Reindex:**
- Job manual vía endpoint admin (`POST /admin/reindex`).
- Triggered automáticamente al final de cada ingesta (`src.ingest.load`).
- En desarrollo: re-ejecutar el comando es la forma estándar de refrescar.

**Documento de log en Meilisearch (forma orientativa, depende del dataset):**

```json
{
  "id": "...",
  "name": "Process Creation",
  "channel": "Microsoft-Windows-Sysmon/Operational",
  "event_id": "1",
  "platform_slug": "windows",
  "log_source_name": "Sysmon",
  "description": "...",
  "technique_ids": ["T1059.001", "T1106"],
  "tactic": ["execution"],
  "_meta": { "dataset_version": "2026.05.01" }
}
```

> Los nombres concretos de campos los fija el dataset upstream. Si cambian, se ajusta el indexer; el frontend no necesita saberlos por nombre.

---

## 6. Ingesta del dataset upstream

Esta app **no procesa** datos de MITRE ni hace mapping logic. Recibe un dataset ya construido por un proyecto independiente del equipo, y lo carga.

**CLI:**
```
python -m src.ingest.load --source <ruta-o-url> [--dry-run] [--dataset-version 2026.05.01]
```

**Pasos del CLI:**
1. **Leer** el dataset (formato a acordar — recomendado JSON Lines o Parquet por entidad: `platforms.jsonl`, `log_sources.jsonl`, `logs.jsonl`, `techniques.jsonl`, `mappings.jsonl`, y un `manifest.json` con la versión y la metadata de filtros).
2. **Validar** contra Pydantic schemas en `apps/api/src/ingest/schemas.py`. Falla rápido si hay drift.
3. **Upsert transaccional** por entidad. Estrategia idempotente por PK natural (slug, id de técnica, etc.).
4. **Actualizar `filter_category`** desde la sección `filters` del manifest del dataset.
5. **Reindexar Meilisearch** al final.
6. **Reportar** al stdout: counts insertados/actualizados/skipped, duración, versión final.

**Manifest sugerido (`manifest.json`):**

```json
{
  "dataset_version": "2026.05.01",
  "generated_at": "2026-05-08T12:00:00Z",
  "entities": ["platforms", "log_sources", "logs", "techniques", "mappings"],
  "filters": [
    { "key": "platform", "label": "Platform", "field_path": "log.platform.slug",
      "value_type": "enum", "ui_hint": "dropdown", "order": 1 },
    { "key": "log_source", "label": "Log Source", "field_path": "log.log_source.name",
      "value_type": "string", "ui_hint": "multiselect", "order": 2 }
  ]
}
```

> El número y nombre de los filtros está intencionalmente abierto. Lo decide el manifest del dataset upstream. Esta app se adapta.

**Frecuencia:** manual / on-demand. No hay cron automático: cuando upstream publica una versión nueva, alguien dispara la ingesta.

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
