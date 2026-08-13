from pydantic import BaseModel, Field


class ErrorOut(BaseModel):
    """Forma estándar de error de la API (ARCHITECTURE.md §3).

    Nunca se devuelve 200 con un error dentro. `code` es estable y pensado para
    que el cliente ramifique sobre él; `detail` es para humanos.
    """

    detail: str
    code: str
    #: Contexto opcional del error, p. ej. las claves de filtro no reconocidas.
    keys: list[str] = Field(default_factory=list)
