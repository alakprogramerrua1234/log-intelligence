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
│  CLI de ingesta  │  ──►  PostgreSQL
│  (apps/api/src/  │       (source of truth:
│   ingest)        │        datos + búsqueda)
└──────────────────┘
                                 ▲
                                 │
┌──────────────┐      HTTPS/JSON │
│  Next.js 16  │ ────────────────┴──► FastAPI
│  (Vercel)    │ ◄─────────────────── (Fly.io)
└──────────────┘
```

- **PostgreSQL** es la fuente de verdad y también resuelve la búsqueda (§5). No hay índice derivado que mantener.
- **El dato lo produce un proyecto upstream del equipo**, no esta app. Aquí se ingiere mediante un CLI que valida y carga.

### 1.1 Unidades desplegables

El corte no es por capa técnica (front / api / db) sino por **ciclo de vida**:

| Unidad | Qué es | Por qué es una unidad propia |
|---|---|---|
| `web` | Next.js | Deploy y release propios (Vercel) |
| `api` | FastAPI sirviendo HTTP | Deploy propio (Fly). La DB es una **capa interna** suya, no una unidad aparte |
| `ingest` | Worker on-demand | Cadencia distinta (batch, disparado por upstream), fallos aislados del serving |

`apps/api/Dockerfile` produce las dos imágenes desde una base común: comparten modelos y repositorios, y lo que las separa es el comando, el ciclo de vida y el escalado. `tests/test_layering.py` verifica que `ingest/` y `search/` no importan la app HTTP, que es lo que hace real la separación.

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

**`event_id`** — identificador del evento dentro de su fuente.
| Campo | Tipo | Notas |
|---|---|---|
| id   | bigserial PK | |
| name | text UNIQUE  | "1", "4688", "AssumeRole", "execve" |

> No siempre es numérico: en Windows es el Event ID (`4688`), en CloudTrail el nombre de la operación (`AssumeRole`), en auditd la syscall (`execve`). El nombre `event_id` viene de Windows y se queda corto para el resto; renombrarlo a algo como `event_code` es deuda conocida, no urgente.
>
> `name` es único **global**, no por fuente: el evento `1` de Sysmon y un hipotético `1` de otra fuente comparten fila. Para filtrar está bien; lo que identifica a un log es el par `(log_source, event_id)` — ver más abajo.

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
| event_id_id      | bigint FK → event_id.id     NOT NULL  | |
| tactic_id        | bigint FK → tactic.id       NOT NULL  | |
| technique_id     | text   FK → technique.id    NOT NULL  | |
| subtechnique_id  | text   FK → subtechnique.id NULL      | sin subtécnica = NULL |
| created_at       | timestamptz                           | timestamp local de ingesta |

> `technique_id` es `NOT NULL`, así que **un log sin ninguna técnica asociada no puede existir en esta tabla**. Es una limitación consciente del modelo actual: el dataset upstream solo produce mappings. Si en algún momento queremos mostrar "logs que hoy no detectan nada" —que es señal de producto útil— hará falta una fuente de logs independiente de los mappings.

**Constraint de unicidad** (la clave de la idempotencia del ingest — sin esto, reejecutar la carga duplicaría todo):

```sql
UNIQUE NULLS NOT DISTINCT
  (platform_id, log_source_id, event_id_id, tactic_id, technique_id, subtechnique_id)
```

> `NULLS NOT DISTINCT` (PostgreSQL 15+) es necesario porque, por defecto, Postgres considera dos `NULL` distintos en un `UNIQUE`. Sin esa cláusula, dos filas con la misma combinación pero `subtechnique_id = NULL` se duplicarían.

### Identidad de un log — decisión abierta

`detection` es una tabla de **mappings**, no de logs. Un log es el par `(log_source, event_id)`, y no tiene fila propia en ningún sitio. Con el dataset actual (`data/log_technique_map.csv`) eso significa:

| | |
|---|---|
| Filas en `detection` | 5.755 |
| Logs únicos `(log_source, event_id)` | 2.467 |
| Logs con una sola técnica | 2.325 (94%) |
| Log más mapeado | `WinEventLog:Sysmon` / `1` — 338 filas, 113 técnicas |

Dos consecuencias abiertas, ambas pendientes de decidir:

1. **Granularidad de `/logs`.** Hoy devuelve una fila por mapping, así que Sysmon 1 aparece 338 veces y los 12 logs más mapeados ocupan el 28% de la tabla. Ver §4.1.
2. **Clave de unión con los datasets futuros.** La vista "Exploit your log" traerá sus propias tablas (hints, campos, reglas de detección) producidas aparte. Todas colgarán de un log concreto, así que el par `(log_source, event_id)` es el candidato natural a clave de unión — **conviene acordarlo con el equipo que produce los datasets antes de que exista la segunda tabla**, porque es un contrato entre proyectos.

### `filter_category` — qué se puede filtrar

Catálogo dinámico. Cada categoría apunta a una **tabla** (dimensión, `technique` o `subtechnique`) de donde se obtienen sus valores y a la FK que usa para filtrar la tabla de hechos.

| Campo         | Tipo     | Notas |
|---|---|---|
| key           | text PK  | identificador estable: `platform`, `log_source`, `event_id`, `tactic`, `technique`, `subtechnique` |
| label         | text     | nombre legible para la UI (i18n a futuro) |
| source_table  | text     | tabla de origen: `platform`, `log_source`, `event_id`, `tactic`, `technique`, `subtechnique` |
| value_column  | text     | columna a mostrar al usuario (`name` para dimensiones; `id` o `name` para technique/subtechnique) |
| detection_fk  | text     | columna de `detection` por la que se filtra: `platform_id`, `log_source_id`, `event_id_id`, `tactic_id`, `technique_id`, `subtechnique_id` |
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
- `detection`: el `UNIQUE NULLS NOT DISTINCT` cubre el lookup por combinación completa, y hay un índice simple por cada FK (`platform_id`, `log_source_id`, `event_id_id`, `tactic_id`, `technique_id`, `subtechnique_id`) para los filtros de una sola categoría.

### Diagrama

```
platform ────┐
log_source ──┤
event_id ────┼──► detection ◄── technique ◄── subtechnique
tactic ──────┘
```

---

## 3. Endpoints API

Base: `/api/v1`. El esquema completo se exporta a [`apps/api/openapi.json`](apps/api/openapi.json) y CI falla si está desactualizado.

**Implementados hoy:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/logs` | **El endpoint clave**. Filtros genéricos: ver §3.1. |
| GET | `/filters/categories` | **Discovery**. Qué categorías de filtro existen, su tipo y `ui_hint`. El frontend se construye a partir de esto. |
| GET | `/filters/values` | Valores distintos de una categoría: `?category=<key>&q=<texto>&limit=` |
| GET | `/filters/suggest` | Autocomplete **cross-categoría**: `?q=<texto>&per_category=` |
| GET | `/healthz` | Liveness. Fuera del prefijo `/api/v1`. |

**No implementados.** El frontend tiene stubs de cliente para `/platforms` en `apps/web/src/lib/api.ts` que no llaman a nada real:

| Ruta | Para qué haría falta |
|---|---|
| `/platforms`, `/platforms/{slug}` | Conteos por plataforma en la landing (hoy son mock) |
| `/logs/{id}` | Vista de detalle — llegará con el dataset de "Exploit your log" |
| `/techniques`, `/techniques/{id}` | Navegación inversa técnica → logs |
| `/coverage` | Matriz de cobertura |

### 3.1 Filtros genéricos en `/logs`

El contrato de filtros es **dinámico**. La sintaxis aceptada:

```
GET /logs?filter[<category_key>]=<value>&filter[<category_key>]=<value>&q=<texto>&sort=<key>&sort_dir=asc|desc&cursor=<c>&limit=50
```

- `category_key` es una clave declarada en `filter_category`. La API rechaza claves desconocidas con `400`.
- Multi-valor por repetición: `?filter[tactic]=execution&filter[tactic]=persistence` (semántica OR dentro de la misma categoría, AND entre categorías distintas).
- `q` es texto libre: `LIKE` insensible a mayúsculas sobre todas las columnas filtrables (§5.2).
- `sort` es una clave de `SORTABLE`, que coincide con el `column.id` de TanStack Table. Una clave no ordenable devuelve `400 unknown_sort_key`.

> **`view` no es un parámetro de la API.** El cliente lo envía (`apps/web/src/lib/api.ts`) y el router lo ignora: hoy compact/full es solo un cambio de columnas en el frontend. Es una inconsistencia real, no un descuido de documentación — ver §4.1.

> **Por qué genérico:** las categorías de filtrado todavía no están cerradas. Esta forma permite añadir/quitar filtros tocando solo `filter_category` + indexación, sin redeploy del frontend.

**Convenciones de respuesta:**
- Listas paginadas devuelven `{ items: [...], next_cursor: "...", total: 1234 }`.
- **Cursor-based, no offset.** El cursor es **opaco** (base64 de `{k, v}`): el cliente lo reenvía tal cual y nunca lo construye. Esa opacidad es lo que permite cambiar de estrategia de paginación —hoy keyset sobre `detection.id`— sin tocar el contrato. Un cursor que no salió de ese mismo listado se rechaza con `400 invalid_cursor` en vez de interpretarse mal.
- Errores con la forma de `schemas/errors.py::ErrorOut` — `{ "detail": "...", "code": "log_not_found", "keys": [] }`. El cliente ramifica sobre `code`, nunca sobre `detail`. El tipo espejo es `ApiErrorBody` en `apps/web/src/lib/types/`.
- Todo endpoint que devuelva listas acepta `limit` acotado. Nada sin techo.

---

## 4. Flujo crítico: tabla de logs

Esta es la pieza con más lógica de la app.

### 4.1 Vista comprimida vs completa — DECISIÓN ABIERTA

**Qué hay hoy:** dos juegos de columnas en `columns.tsx`. `compact` omite *Technique Name* y *Subtechnique Name*; `full` las muestra. Nada más. Ambas pintan **una fila por mapping**, que es lo que devuelve la API. El parámetro `view` viaja en la query pero el backend no lo lee (§3.1).

**Por qué no basta.** El objetivo de la vista Explore es que un analista identifique *qué logs le sirven*. Con una fila por mapping eso no se ve: Sysmon Event 1 ocupa 338 filas de 5.755, los 12 logs más mapeados se llevan el 28% de la tabla, y los 2.325 logs con una sola técnica (94% del total) quedan enterrados detrás. Ocultar dos columnas no cambia el nivel de información — solo el ancho.

**Propuesta pendiente de decidir:** que el toggle cambie la *granularidad*, no las columnas.

| Modo | Fila | Filas con el dataset actual |
|---|---|---|
| `compact` | un **log** — `(log_source, event_id)` con nº de técnicas, tácticas cubiertas y score | 2.467 |
| `full` | un **mapping** — lo que hay hoy | 5.755 |

Se resuelve con un `GROUP BY` sobre `detection`: **no requiere migración ni tabla nueva**. Implica implementar `view` en el router y una segunda forma de respuesta.

> La versión anterior de este documento describía aquí un drill-down jerárquico configurable (una config `hierarchy.py`, filas del "nivel N+1", auto-expansión al llegar a la hoja). Nunca se implementó y no está claro que resuelva el problema real, que es de granularidad y no de navegación por niveles. Queda descartado salvo que reaparezca una necesidad concreta.

### 4.1.1 Score / Ranking — DECISIÓN ABIERTA

La columna *Ranking* de la tabla y la sección *Top logs* de la landing pintan un score que **no existe**: `DetectionOut.relevance` es un `0` fijo, y la landing se alimenta de `mock-data.ts`.

El dataset sí permite derivarlo. Contando técnicas distintas por log, el orden que sale es coherente con la intuición de dominio:

| log_source | event | técnicas | tácticas |
|---|---|---|---|
| WinEventLog:Sysmon | 1 | 113 | 13 |
| WinEventLog:Sysmon | 11 | 72 | 13 |
| WinEventLog:Security | 4688 | 68 | 13 |
| auditd:SYSCALL | execve | 63 | 13 |

Lo que falta decidir es **de quién sale**: si lo produce el proyecto upstream junto al dataset (coherente con el reparto de responsabilidades del §1) o si esta app lo deriva al ingerir. Mientras no se decida, no conviene pintar un número inventado sin etiquetarlo como tal.

### 4.2 Filtros y URL

Los filtros viven en la URL. Esquema **genérico**:

```
/explore?f.<categoryKey>=valor&f.<categoryKey>=otro&q=process&view=compact
```

Ejemplos (las claves concretas dependen de lo que devuelva `/filters/categories`):

```
/explore?f.platform=windows&f.log_source=sysmon&q=process&view=compact
/explore?f.something=x&f.other=y                      # mañana podemos añadir categorías sin tocar código
```

Cada categoría puede aparecer múltiples veces para multi-selección: `?f.tactic=execution&f.tactic=persistence`.

**Implementación frontend (`apps/web/src/hooks/useFilterParams.ts` + `src/lib/url-state.ts`):** un parser que lee cualquier `f.*` como arrays de strings sin enumerar las claves. Las claves válidas se validan contra `/filters/categories` cuando se renderizan los chips/dropdowns; una clave que la API no reconoce vuelve como `400 unknown_filter_category`, no se ignora en silencio.

Se probó `nuqs` primero y se retiró: su API pide declarar las claves en tiempo de compilación, incompatible con categorías descubiertas en runtime — justo la premisa de este sistema de filtros. La URL se escribe con la History API (`history.pushState`, conservando `history.state` porque ahí vive el árbol interno del router de Next) y un store mínimo notifica a los componentes suscritos vía `useSyncExternalStore`. No se usa `router.push`: envuelve la navegación en una transición de React, y las actualizaciones de TanStack Query durante esa transición hacían que no llegara a confirmarse nunca — la página se quedaba sin responder a ninguna navegación posterior. Por el mismo motivo, la navegación entre secciones (`SiteHeader`) usa `<a>` en vez de `<Link>`: con la URL escrita a mano, el router de Next queda apuntando a un estado que no reconoce y sus propios `<Link>` dejan de confirmar transiciones.

**Por qué URL y no solo state:** un analista que encuentra un patrón puede pegar la URL en Slack del SOC y el resto la abre con la misma vista exacta.

### 4.3 Búsqueda global (command palette)

Componente `cmdk` con dos modos:
1. **Búsqueda libre** → `/filters/suggest?q=...` devuelve valores de todas las categorías a la vez, cada uno etiquetado con la suya. Confirmar uno lo añade como filtro. Además hay siempre una opción "buscar el texto tal cual", que escribe `q=` en la URL y filtra la tabla vía `/logs?q=`.
2. **Filtrado por categoría** → al escribir `<categoryKey>:`, o al fijar una categoría desde el botón *Filter by*, llama a `/filters/values?category=<key>&q=...` y lista solo valores de esa categoría.

El menú de categorías se construye dinámicamente desde `/filters/categories` (cacheado en cliente vía TanStack Query). Añadir una categoría nueva en el backend hace que aparezca automáticamente en el palette tras la próxima revalidación.

Al confirmar un valor → se añade como chip (filtro activo) y la URL se actualiza.

### 4.4 Click en cabecera de columna

Clicar el **nombre** de una columna abre el command palette con esa categoría ya fijada; el icono de orden que va al lado es un botón aparte. Implementado vía `table.options.meta.openPaletteWithCategory(columnKey)` — las celdas y cabeceras no montan hooks propios, reciben todo por `meta`. La clave que pasa la cabecera debe existir en `filter_category` para que el palette tenga valores que sugerir.

Las celdas siguen el mismo patrón: `FilterableCell` muestra un `+` al pasar el ratón que añade ese valor como filtro, usando `meta.addFilter`. Que estas dos cosas viajen por `meta` y no por hooks no es cosmético — con 200 filas × 8 columnas eran más de mil instancias de `useFilterParams`, y era una de las causas del congelado de `/explore`.

---

## 5. Búsqueda

Toda la búsqueda la resuelve **Postgres**. No hay motor de búsqueda dedicado ni índice derivado que mantener.

### 5.1 El seam: `SearchBackend`

La búsqueda vive detrás de un contrato de un solo método (`apps/api/src/search/backend.py`):

```python
def search(q, filters, limit, cursor, sort) -> SearchPage   # ids, total, next_cursor
```

`sort` es opcional y viaja como `SortSpec(key, descending)`, validado contra `SORTABLE` (`apps/api/src/repositories/bindings.py`) — misma idea que `FILTERABLE`, pero para columnas ordenables. Con ordenación activa el cursor deja de ser un simple `id`: es un keyset compuesto `(columna, id)`, con `id` como desempate. Sin ese desempate, dos filas con el mismo valor de columna podrían repetirse o perderse al cambiar de página. El `kind` del cursor codifica la clave y el sentido de la ordenación, así que un cursor de otra ordenación se rechaza (`400 invalid_cursor`) en vez de producir una página incoherente.

**Devuelve ids, no filas.** Hidratar es cosa de `DetectionRepository`, que es quien conoce los joins. Hoy la única implementación es `PostgresSearchBackend`: ordena por `detection.id` y pagina por keyset.

El contrato se mantiene aunque solo haya una implementación, porque es donde vive la paginación por cursor opaco y porque el cliente nunca depende de cómo se pagina. El coste es una query extra (ids → hidratar).

### 5.2 Búsqueda libre `q`

`LIKE '%término%'`, insensible a mayúsculas, sobre **todas las columnas filtrables**. La lista sale de `FILTERABLE`, así que una categoría nueva es buscable sin tocar la query.

El comodín inicial impide usar índice: es un escaneo secuencial. Con el volumen actual (5.755 filas) es irrelevante. Si el dataset crece un orden de magnitud, la primera medida es un índice GIN con `pg_trgm`, que además daría tolerancia a erratas en el autocomplete. Un motor de búsqueda aparte solo se justificaría bastante más allá de eso.

> **Hubo un backend de Meilisearch y se retiró.** Estaba completo (cliente, indexador, CLI de reindexado, servicio en compose) pero apagado por defecto y nunca ejecutado contra una instancia real — código sin verificar que aparentaba estar listo, con diferencias de comportamiento conocidas frente a Postgres, como la sensibilidad a mayúsculas de sus filtros. Se eliminó por eso, no solo por el volumen. Si alguna vez hace falta, vuelve por este mismo seam; está en el historial de git.

---

## 6. Ingesta del dataset upstream

Esta app **no procesa** datos de MITRE ni hace mapping logic. Recibe un **CSV de detecciones** ya construido por un proyecto independiente del equipo, y lo carga en la tabla de hechos `detection`.

**Formato del CSV** — una fila por detección, las siguientes columnas (orden estable, cabecera obligatoria):

| Columna           | Obligatoria | Notas |
|---|---|---|
| platform          | sí | nombre legible. Se upserta en `platform.name`. |
| log_source        | sí | se upserta en `log_source.name`. |
| event_id          | sí | se upserta en `event_id.name`. No tiene por qué ser numérico. |
| tactic            | sí | se upserta en `tactic.name`. |
| technique_id      | sí | ID de ATT&CK ("T1059"). Upsert en `technique`. |
| technique_name    | sí | nombre legible de la técnica. |
| subtechnique_id   | no | ID de ATT&CK ("T1059.001") o vacío. |
| subtechnique_name | no | nombre de la subtécnica si aplica. |

**Una fila del CSV → una fila en `detection`.** El `UNIQUE NULLS NOT DISTINCT` deduplica al cargar: reejecutar la misma ingesta es no-op.

**Ficheros en `data/`:** `sample.csv` es el ejemplo del formato y se versiona; el dataset real (`log_technique_map.csv`, 5.755 filas) está en `.gitignore` porque lo regenera upstream.

**CLI:**
```
python -m src.ingest.load --source <ruta-al-csv> [--dry-run]
```

**Pasos del CLI:**
1. **Sembrar `filter_category`** si está vacía (`ON CONFLICT DO NOTHING` — no pisa cambios hechos a mano en `label`, `order` o `enabled`).
2. **Leer** el CSV en streaming (no cargar todo en memoria).
3. **Validar** cada fila contra el schema Pydantic de `apps/api/src/ingest/schemas.py`. Una fila inválida se reporta a stderr y se salta; no aborta la carga.
4. **Upsert de dimensiones** (`platform`, `log_source`, `event_id`, `tactic`) por `name`, cacheando `name → id` en memoria.
5. **Upsert de `technique`** por PK natural: `INSERT ... ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`.
6. **Upsert de `subtechnique`** con el mismo patrón + FK `technique_id`. Columna vacía en el CSV ⇒ `NULL` en `detection.subtechnique_id` (no se crea fila en `subtechnique`).
7. **Insert en `detection`** con `ON CONFLICT DO NOTHING` sobre `uq_detection_combination`. Los duplicados se cuentan, no fallan.
8. **Reportar** a stdout: filas leídas, inválidas, insertadas, duplicadas, dimensiones nuevas y duración. `load()` devuelve además un `LoadReport` para poder afirmarlo en tests.

No hay paso de reindexado: la búsqueda va contra las mismas tablas, así que al terminar la carga los datos ya son buscables.

**Idempotencia:** correr la misma ingesta dos veces deja la DB idéntica. No hace falta truncar.

**Frecuencia:** manual / on-demand. No hay cron automático: cuando upstream publica un CSV nuevo, alguien dispara la ingesta.

---

## 7. Frontend: estructura de componentes clave

```
log-table/
├── LogTableClient.tsx        # "use client", tabla + interacciones
├── ExploreHeader.tsx         # Título, lee la plataforma activa del cliente
├── columns.tsx                # Definiciones TanStack (full + compact)
├── ViewToggle.tsx             # Compact / Full
└── cells/
    ├── FilterableCell.tsx     # Celda -> filtro. Sin hooks: se monta ~1 vez por celda
    ├── TechniqueCell.tsx      # Chips clicables
    └── EventIdCell.tsx

filters/
├── CommandPalette.tsx         # cmdk: búsqueda libre + filtrado por categoría
└── FilterChips.tsx            # Filtros activos, con opción de quitarlos

platform/
└── PlatformSidebar.tsx        # Plataformas desde /filters/values, no un catálogo mock

lib/
├── url-state.ts               # Dueño único de los search params (ver §4.2)
└── format.ts                  # Intl.NumberFormat fijo — toLocaleString() sin
                                # locale explícito da resultados distintos en
                                # servidor y cliente y React lo trata como
                                # hydration mismatch
```

La tabla (`LogTableClient.tsx`) virtualiza filas con `@tanstack/react-virtual`: solo se montan las visibles (~20 de 200), no todo el resultado. Sin esto, cualquier cambio de estado en la página —incluido uno que no toca la URL, como abrir el command palette— repintaba las 200 filas × 8 columnas y bloqueaba el hilo principal varios segundos.

---

## 8. Decisiones abiertas y parking lot

### 8.1 Abiertas — bloquean trabajo en curso

| Decisión | Dónde | Por qué bloquea |
|---|---|---|
| Granularidad de Explore: ¿una fila por log o por mapping? | §4.1 | Define qué hace el toggle compact/full y si `/logs` necesita agregación |
| Origen del score | §4.1.1 | La columna *Ranking* y la vista Ranking pintan datos falsos hasta que se resuelva |
| Clave de unión de un log entre datasets | §2 | Contrato con el proyecto upstream; caro de cambiar una vez exista la segunda tabla |

### 8.2 Parking lot

- Autenticación y multi-tenancy.
- Subir mappings propios del usuario (su SIEM detecta X event ID con Y query).
- Integraciones (Splunk, Elastic, Sentinel) para auto-coverage.
- Versionado de datasets en DB (poder volver a una versión anterior sin reingestar).
- Diff visual entre dos versiones del dataset upstream.
- API pública con rate-limit por API key.
- Renombrar la dimensión `event_id` a algo no Windows-céntrico (§2).

### 8.3 Vistas de producto y su estado

| Vista | Estado |
|---|---|
| **Explore logs** | Funcional end-to-end contra datos reales. Pendiente la granularidad (§4.1) y el score (§4.1.1). |
| **Exploit your log** | Solo UI, sobre `apps/web/src/lib/exploit-mock.ts`. El dataset se está produciendo aparte y traerá **sus propias tablas** (hints, campos, reglas). Nada de eso se modela todavía aquí. |
| **Ranking** | Sin implementar. La sección *Top logs* de la landing es mock. Depende del score. |
