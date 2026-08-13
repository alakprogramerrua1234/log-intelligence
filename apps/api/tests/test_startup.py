"""El arranque valida el catálogo de filtros contra el registro de código.

Es la red que convierte un fallo invisible en producción (filtros ignorados en
silencio) en un fallo de boot.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from src import database, main
from src.models import FilterCategory
from src.services import FilterCatalogError


def _orphan_category(enabled: bool) -> FilterCategory:
    """Una categoría cuya dimensión no tiene binding en FILTERABLE."""
    return FilterCategory(
        key="data_source",
        label="Data Source",
        source_table="data_source",
        value_column="name",
        detection_fk="data_source_id",
        value_type="string",
        ui_hint="multiselect",
        order=99,
        enabled=enabled,
    )


def test_app_starts_with_a_consistent_catalog(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}


def test_app_refuses_to_start_with_orphan_category(
    session_factory: sessionmaker[Session],
    seeded: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with session_factory() as session:
        session.add(_orphan_category(enabled=True))
        session.commit()
    monkeypatch.setattr(database, "SessionLocal", session_factory)

    with pytest.raises(FilterCatalogError, match="data_source"), TestClient(main.app):
        pass  # pragma: no cover - el fallo ocurre al entrar en el contexto


def test_disabled_category_does_not_block_startup(
    session_factory: sessionmaker[Session],
    seeded: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Apagar una categoría es la vía para retirarla sin migración ni deploy."""
    with session_factory() as session:
        session.add(_orphan_category(enabled=False))
        session.commit()
    monkeypatch.setattr(database, "SessionLocal", session_factory)

    with TestClient(main.app) as test_client:
        assert test_client.get("/healthz").status_code == 200


def test_app_refuses_to_start_when_catalog_drifts_from_code(
    session_factory: sessionmaker[Session],
    seeded: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La fila existe y el binding también, pero apuntan a columnas distintas."""
    with session_factory() as session:
        category = session.get(FilterCategory, "platform")
        assert category is not None
        category.detection_fk = "tactic_id"
        session.commit()
    monkeypatch.setattr(database, "SessionLocal", session_factory)

    with pytest.raises(FilterCatalogError, match="detection_fk"), TestClient(main.app):
        pass  # pragma: no cover
