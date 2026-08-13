from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/log_intelligence"
    meilisearch_url: str = "http://localhost:7700"
    meilisearch_api_key: str = ""
    meilisearch_index: str = "detections"

    #: Postgres por defecto: la app arranca y sirve sin depender de Meilisearch.
    #: Cambiar a "meilisearch" requiere haber corrido `python -m src.search.reindex`.
    search_backend: Literal["postgres", "meilisearch"] = "postgres"


settings = Settings()
