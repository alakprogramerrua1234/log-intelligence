"""Ingesta del CSV upstream.

Los upserts usan `ON CONFLICT` de Postgres, así que estos tests **necesitan
Postgres**: contra SQLite no probarían lo que importa (idempotencia y
`UNIQUE NULLS NOT DISTINCT`). Se saltan si no hay DB, para que la suite siga
corriendo sin infraestructura.

    docker compose up -d postgres
    docker exec logintel-postgres createdb -U logintel logintel_test   # una vez
    TEST_DATABASE_URL=postgresql+psycopg://logintel:logintel@localhost:5432/logintel_test \
        uv run --directory apps/api pytest

**La base tiene que ser desechable**: el fixture `engine` hace `drop_all()`.
Ver `_require_disposable_database`.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine, create_engine, func, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from src.ingest.load import load
from src.models import Base, Detection, EventId, LogSource, Platform, Subtechnique, Technique

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="define TEST_DATABASE_URL (Postgres) para ejercitar la ingesta",
)


def _require_disposable_database(url: str) -> None:
    """Aborta si `TEST_DATABASE_URL` no apunta a una base claramente de test.

    El fixture `engine` hace `drop_all()` al entrar y al salir. Apuntado a la
    base de desarrollo se lleva por delante el dataset ingerido, y el borrado es
    difícil de notar: `alembic_version` no está en `Base.metadata`, así que
    sobrevive, y un `alembic upgrade head` posterior se cree al día y no
    reconstruye nada.

    Exigir "test" en el nombre convierte ese accidente en un error ruidoso.
    """
    name = (make_url(url).database or "").lower()
    if "test" not in name:
        raise pytest.UsageError(
            f"TEST_DATABASE_URL apunta a la base '{name}', que no parece de test. "
            "Estos tests ejecutan drop_all() y borrarían sus datos. "
            "Usa una base cuyo nombre contenga 'test' (p. ej. logintel_test)."
        )


if TEST_DATABASE_URL:
    _require_disposable_database(TEST_DATABASE_URL)

HEADER = (
    "platform,log_source,event_id,tactic,"
    "technique_id,technique_name,subtechnique_id,subtechnique_name\n"
)
ROW_WITH_SUB = "Windows,Sysmon,1,execution,T1059,Command and Scripting,T1059.001,PowerShell\n"
ROW_WITHOUT_SUB = "Windows,Sysmon,1,execution,T1059,Command and Scripting,,\n"
ROW_LINUX = "Linux,Auditd,SYSCALL,persistence,T1053,Scheduled Task,T1053.003,Cron\n"


@pytest.fixture
def engine() -> Iterator[Engine]:
    assert TEST_DATABASE_URL
    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture
def csv_file(tmp_path: Path) -> Path:
    return tmp_path / "detections.csv"


def _write(path: Path, *rows: str) -> Path:
    path.write_text(HEADER + "".join(rows), encoding="utf-8")
    return path


def _count(session_factory: sessionmaker[Session], model: type) -> int:
    with session_factory() as session:
        return session.execute(select(func.count()).select_from(model)).scalar_one()


# ── carga básica ──────────────────────────────────────────────────────────────


def test_loads_rows_and_dimensions(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    report = load(_write(csv_file, ROW_WITH_SUB, ROW_LINUX), False, session_factory)

    assert report.rows_read == 2
    assert report.rows_inserted == 2
    assert _count(session_factory, Detection) == 2
    assert _count(session_factory, Platform) == 2
    assert _count(session_factory, Technique) == 2


def test_dimensions_are_deduplicated_across_rows(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    """Dos filas de la misma plataforma no crean dos plataformas."""
    load(_write(csv_file, ROW_WITH_SUB, ROW_WITHOUT_SUB), False, session_factory)

    assert _count(session_factory, Platform) == 1
    assert _count(session_factory, LogSource) == 1
    assert _count(session_factory, EventId) == 1


def test_row_without_subtechnique_creates_no_subtechnique(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    load(_write(csv_file, ROW_WITHOUT_SUB), False, session_factory)

    assert _count(session_factory, Subtechnique) == 0
    with session_factory() as session:
        assert session.execute(select(Detection.subtechnique_id)).scalar_one() is None


# ── idempotencia ──────────────────────────────────────────────────────────────


def test_rerunning_the_same_load_is_a_no_op(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    """La promesa de ARCHITECTURE.md §6: reejecutar deja la DB idéntica."""
    source = _write(csv_file, ROW_WITH_SUB, ROW_LINUX)
    load(source, False, session_factory)

    second = load(source, False, session_factory)

    assert second.rows_inserted == 0
    assert second.rows_duplicate == 2
    assert _count(session_factory, Detection) == 2


def test_duplicate_rows_within_one_file_are_collapsed(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    report = load(_write(csv_file, ROW_WITH_SUB, ROW_WITH_SUB), False, session_factory)

    assert report.rows_inserted == 1
    assert report.rows_duplicate == 1


def test_null_subtechnique_does_not_duplicate(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    """El caso que motiva `UNIQUE NULLS NOT DISTINCT`.

    Por defecto Postgres considera dos NULL distintos en un UNIQUE, así que sin
    esa cláusula estas dos filas idénticas se duplicarían en cada carga.
    """
    report = load(_write(csv_file, ROW_WITHOUT_SUB, ROW_WITHOUT_SUB), False, session_factory)

    assert report.rows_inserted == 1
    assert _count(session_factory, Detection) == 1


def test_a_row_with_and_without_subtechnique_are_different_detections(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    load(_write(csv_file, ROW_WITH_SUB, ROW_WITHOUT_SUB), False, session_factory)
    assert _count(session_factory, Detection) == 2


# ── validación y dry-run ──────────────────────────────────────────────────────


def test_invalid_rows_are_reported_and_skipped(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    orphan_name = "Windows,Sysmon,1,execution,T1059,Command and Scripting,,PowerShell\n"
    report = load(_write(csv_file, ROW_WITH_SUB, orphan_name), False, session_factory)

    assert report.rows_read == 2
    assert report.rows_invalid == 1
    assert report.rows_inserted == 1


def test_dry_run_commits_nothing(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    report = load(_write(csv_file, ROW_WITH_SUB, ROW_LINUX), True, session_factory)

    assert report.rows_inserted == 2, "el dry-run debe reportar lo que haría"
    assert _count(session_factory, Detection) == 0, "pero no debe persistir nada"
    assert _count(session_factory, Platform) == 0


def test_empty_file_is_not_an_error(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    report = load(_write(csv_file), False, session_factory)
    assert report.rows_read == 0
    assert report.rows_inserted == 0


def test_seeds_the_filter_catalog(
    csv_file: Path, session_factory: sessionmaker[Session]
) -> None:
    """Sin catálogo, la API no arranca: la primera ingesta debe dejarlo puesto."""
    from src.models import FilterCategory

    load(_write(csv_file, ROW_WITH_SUB), False, session_factory)
    assert _count(session_factory, FilterCategory) > 0
