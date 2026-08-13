"""Fixtures de test.

El read-path corre contra SQLite en memoria para que la suite no necesite
infraestructura. Lo específico de Postgres (upserts de la ingesta,
`UNIQUE NULLS NOT DISTINCT`) no se ejercita aquí: eso pide una suite aparte
contra el Postgres de docker-compose.
"""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, Engine, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from src import database, main
from src.database import get_db
from src.ingest.load import FILTER_CATEGORIES
from src.models import (
    Base,
    Detection,
    EventId,
    FilterCategory,
    LogSource,
    Platform,
    Subtechnique,
    Tactic,
    Technique,
)


@compiles(BigInteger, "sqlite")
def _bigint_as_integer(element: Any, compiler: Any, **kw: Any) -> str:
    """SQLite solo auto-incrementa `INTEGER PRIMARY KEY`, no `BIGINT`.

    Afecta únicamente al dialecto sqlite, es decir solo a los tests.
    """
    return "INTEGER"


# ── datos de prueba ───────────────────────────────────────────────────────────
# (platform, log_source, event_id, tactic, technique_id, technique_name,
#  subtechnique_id, subtechnique_name)
SEED_ROWS: list[tuple[str, str, str, str, str, str, str | None, str | None]] = [
    ("Windows", "Sysmon", "1", "execution", "T1059", "Command and Scripting Interpreter",
     "T1059.001", "PowerShell"),
    ("Windows", "Sysmon", "1", "execution", "T1059", "Command and Scripting Interpreter",
     "T1059.003", "Windows Command Shell"),
    ("Windows", "Windows Security", "4688", "execution", "T1059",
     "Command and Scripting Interpreter", None, None),
    ("Linux", "Auditd", "SYSCALL", "persistence", "T1053", "Scheduled Task/Job",
     "T1053.003", "Cron"),
    ("AWS", "CloudTrail", "ConsoleLogin", "initial-access", "T1078", "Valid Accounts",
     None, None),
]


def _seed(session: Session) -> None:
    session.add_all(FilterCategory(**row) for row in FILTER_CATEGORIES)

    dim_cache: dict[tuple[str, str], int] = {}

    def dim(model: type[Any], name: str) -> int:
        key = (model.__tablename__, name)
        if key not in dim_cache:
            instance = model(name=name)
            session.add(instance)
            session.flush()
            dim_cache[key] = instance.id
        return dim_cache[key]

    seen_techniques: set[str] = set()
    seen_subtechniques: set[str] = set()

    for platform, log_source, event_id, tactic, tid, tname, sid, sname in SEED_ROWS:
        if tid not in seen_techniques:
            session.add(Technique(id=tid, name=tname))
            seen_techniques.add(tid)
            session.flush()
        if sid is not None and sid not in seen_subtechniques:
            session.add(Subtechnique(id=sid, name=sname or "", technique_id=tid))
            seen_subtechniques.add(sid)
            session.flush()

        session.add(
            Detection(
                platform_id=dim(Platform, platform),
                log_source_id=dim(LogSource, log_source),
                event_id_id=dim(EventId, event_id),
                tactic_id=dim(Tactic, tactic),
                technique_id=tid,
                subtechnique_id=sid,
            )
        )


# ── fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def engine() -> Iterator[Engine]:
    eng = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


@pytest.fixture
def seeded(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as session:
        _seed(session)
        session.commit()


@pytest.fixture
def db(session_factory: sessionmaker[Session], seeded: None) -> Iterator[Session]:
    with session_factory() as session:
        yield session


@pytest.fixture
def client(
    session_factory: sessionmaker[Session],
    seeded: None,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[TestClient]:
    # El lifespan valida el catálogo con `database.SessionLocal` directamente,
    # no vía Depends, así que hay que redirigirlo también.
    monkeypatch.setattr(database, "SessionLocal", session_factory)

    def override_get_db() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    main.app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        main.app.dependency_overrides.clear()
