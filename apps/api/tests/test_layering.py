"""Guardarraíles de arquitectura, verificados en CI.

Sin esto, "los routers no llevan SQL" es una convención en un markdown que se
erosiona en el primer PR con prisa. Aquí es un fallo de build.

Dos fronteras:

1. **Persistencia** — solo `repositories/` importa SQLAlchemy y ejecuta queries.
2. **Servicio de ingesta** — `ingest/` y `search/` no dependen de la app que
   sirve HTTP, que es lo que permite desplegarlos por separado.

Los composition roots están exentos por diseño: existen justamente para atar
capas, y se listan uno a uno para que la exención no se extienda sola.
"""

import ast
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parent.parent / "src"

#: Paquetes donde no puede haber SQLAlchemy ni ejecución de queries.
CONSTRAINED_PACKAGES = ("routers", "services", "search")

#: Composition roots / entrypoints: atan capas, así que pueden ver la Session.
#: Vacío hoy — `src/dependencies.py` es el único composition root y no está en
#: `CONSTRAINED_PACKAGES`. Se conserva el mecanismo porque la exención vuelve a
#: hacer falta en cuanto un paquete restringido gane un entrypoint propio.
EXEMPT: set[str] = set()

#: Paquetes que deben poder desplegarse sin la app HTTP.
STANDALONE_PACKAGES = ("ingest", "search")
HTTP_LAYER = ("src.main", "src.routers", "src.dependencies", "fastapi")

FORBIDDEN_TOKENS = {
    "Session": "abrir sesiones es cosa de repositories/",
    "get_db": "los routers reciben services, no la DB",
    ".execute(": "ejecutar SQL es cosa de repositories/",
}


def _imports(source: str) -> list[str]:
    modules: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            modules.append(node.module or "")
    return modules


def _sqlalchemy_imports(source: str) -> list[str]:
    return [module for module in _imports(source) if module.startswith("sqlalchemy")]


def _http_imports(source: str) -> list[str]:
    return [
        module
        for module in _imports(source)
        if any(module == prefix or module.startswith(f"{prefix}.") for prefix in HTTP_LAYER)
    ]


def _forbidden_tokens(source: str) -> list[str]:
    return [token for token in FORBIDDEN_TOKENS if token in source]


def _relative(path: Path) -> str:
    return path.relative_to(SRC).as_posix()


def _python_files(package: str) -> list[Path]:
    return sorted(p for p in (SRC / package).glob("*.py") if p.name != "__init__.py")


def _files(packages: tuple[str, ...], skip_exempt: bool) -> list[Path]:
    return [
        path
        for package in packages
        for path in _python_files(package)
        if not (skip_exempt and _relative(path) in EXEMPT)
    ]


# ── self-tests: que los guardarraíles detecten de verdad ──────────────────────

VIOLATING_ROUTER = """
from fastapi import Depends
from sqlalchemy.orm import Session

from src.database import get_db


def list_things(db: Session = Depends(get_db)):
    return db.execute("select 1").all()
"""

VIOLATING_WORKER = "from src.routers import detections\nfrom src.main import app\n"


def test_guard_detects_sqlalchemy_import() -> None:
    assert _sqlalchemy_imports(VIOLATING_ROUTER) == ["sqlalchemy.orm"]


def test_guard_detects_forbidden_tokens() -> None:
    assert set(_forbidden_tokens(VIOLATING_ROUTER)) == {"Session", "get_db", ".execute("}


def test_guard_detects_http_layer_import() -> None:
    assert set(_http_imports(VIOLATING_WORKER)) == {"src.routers", "src.main"}


def test_guard_passes_on_clean_source() -> None:
    clean = "from src.services import DetectionService\n\ndef f(s: DetectionService): ...\n"
    assert _sqlalchemy_imports(clean) == []
    assert _http_imports(clean) == []
    assert _forbidden_tokens(clean) == []


def test_exemptions_point_at_real_files() -> None:
    """Una exención con ruta obsoleta silenciaría un fichero que sí existe."""
    for exemption in EXEMPT:
        assert (SRC / exemption).exists(), exemption


# ── el código real ────────────────────────────────────────────────────────────


def test_constrained_packages_are_not_empty() -> None:
    """Si el refactor borra las capas, este fichero dejaría de proteger nada."""
    for package in CONSTRAINED_PACKAGES + STANDALONE_PACKAGES:
        assert _python_files(package), f"src/{package}/ no tiene módulos"


@pytest.mark.parametrize("path", _files(CONSTRAINED_PACKAGES, True), ids=_relative)
def test_no_sqlalchemy_imports_outside_repositories(path: Path) -> None:
    imports = _sqlalchemy_imports(path.read_text(encoding="utf-8"))
    assert not imports, (
        f"{_relative(path)} importa {', '.join(imports)}. Solo repositories/ habla SQLAlchemy."
    )


@pytest.mark.parametrize("path", _files(CONSTRAINED_PACKAGES, True), ids=_relative)
def test_no_session_or_query_execution(path: Path) -> None:
    for token in _forbidden_tokens(path.read_text(encoding="utf-8")):
        pytest.fail(f"{_relative(path)} usa '{token}': {FORBIDDEN_TOKENS[token]}")


@pytest.mark.parametrize("path", _files(STANDALONE_PACKAGES, False), ids=_relative)
def test_workers_do_not_depend_on_the_http_app(path: Path) -> None:
    """La ingesta y el indexador se despliegan aparte: no pueden importar la API."""
    imports = _http_imports(path.read_text(encoding="utf-8"))
    assert not imports, (
        f"{_relative(path)} importa {', '.join(imports)}. "
        "ingest/ y search/ deben poder ejecutarse sin la app HTTP."
    )
