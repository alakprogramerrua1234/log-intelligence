"""Construye los documentos de Meilisearch a partir de las detecciones.

Nada se hardcodea: la forma del documento, los atributos filtrables y los
buscables salen del catálogo `filter_category` cruzado con `FILTERABLE`. Añadir
una dimensión no obliga a tocar este fichero.

`filter_category.order` hace doble función: ordena los filtros en la UI **y**
define la prioridad de los atributos en `searchableAttributes` (en Meilisearch el
orden de esa lista es el orden de ranking). Una sola declaración, dos efectos —
en vez del YAML de pesos aparte que contemplaba el plan original.
"""

from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from typing import Any

from src.models import FilterCategory
from src.repositories import FILTERABLE, DetectionRecord
from src.search.client import MeiliClient

PRIMARY_KEY = "id"
DEFAULT_BATCH_SIZE = 1000


def display_field(key: str) -> str:
    """Nombre del atributo legible que acompaña a `key` cuando difiere del valor."""
    return f"{key}_name"


def build_document(record: DetectionRecord, keys: Sequence[str]) -> dict[str, Any]:
    """Aplana una detección: un atributo por categoría, más su texto legible.

    El atributo con el nombre de la categoría lleva el **valor filtrable** (el ID
    de ATT&CK en technique/subtechnique), para que coincida con lo que viaja en
    `filter[<key>]=`. El nombre legible va en `<key>_name` solo cuando difiere.
    """
    document: dict[str, Any] = {PRIMARY_KEY: record.id}
    for key in keys:
        binding = FILTERABLE[key]
        value = getattr(record, binding.record_value_field)
        display = getattr(record, binding.record_display_field)
        document[key] = value
        if binding.record_display_field != binding.record_value_field:
            document[display_field(key)] = display
    return document


def filterable_attributes(keys: Sequence[str]) -> list[str]:
    return list(keys)


def searchable_attributes(keys: Sequence[str]) -> list[str]:
    """En orden de catálogo: es también el orden de ranking en Meilisearch."""
    attributes: list[str] = []
    for key in keys:
        binding = FILTERABLE[key]
        attributes.append(key)
        if binding.record_display_field != binding.record_value_field:
            attributes.append(display_field(key))
    return attributes


@dataclass(frozen=True)
class IndexReport:
    documents: int
    filterable: list[str]
    searchable: list[str]


def _batched(
    records: Iterable[DetectionRecord], keys: Sequence[str], size: int
) -> Iterator[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    for record in records:
        batch.append(build_document(record, keys))
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def reindex(
    client: MeiliClient,
    index: str,
    categories: Sequence[FilterCategory],
    records: Iterable[DetectionRecord],
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> IndexReport:
    """Reconstruye el índice. Idempotente: `PUT` de documentos por clave primaria.

    Meilisearch es un índice derivado, no fuente de verdad (ARCHITECTURE.md §1):
    reejecutar esto siempre es seguro.
    """
    keys = [category.key for category in categories]
    filterable = filterable_attributes(keys)
    searchable = searchable_attributes(keys)

    client.ensure_index(index, PRIMARY_KEY)
    client.update_settings(index, filterable, searchable)

    total = sum(
        client.replace_documents(index, batch) for batch in _batched(records, keys, batch_size)
    )
    return IndexReport(documents=total, filterable=filterable, searchable=searchable)
