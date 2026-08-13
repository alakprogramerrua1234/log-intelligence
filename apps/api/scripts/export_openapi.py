"""Vuelca el esquema OpenAPI a disco.

    uv run --directory apps/api python scripts/export_openapi.py

El fichero resultante (`apps/api/openapi.json`) se commitea a propósito: es el
contrato API ↔ web, y verlo cambiar en el diff de un PR es la señal de que hay
que regenerar los tipos del frontend. `pnpm --filter web check:types` lo verifica.

No necesita base de datos: solo importa la app para leer su esquema.
"""

import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_ROOT))

from src.main import app  # noqa: E402 - requiere el sys.path de arriba

DEFAULT_OUTPUT = API_ROOT / "openapi.json"


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    # sort_keys: sin esto el orden puede variar entre versiones y ensuciar diffs.
    schema = json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False)
    output.write_text(schema + "\n", encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
