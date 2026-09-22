import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.environ.get("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    database_url_direct: str
    test_database_url: str | None = None

    secret_key: str
    environment: str = "development"

    fit_margin_ft: float = 0
    tight_fit_ft: float = 5

    seed_admin_password: str | None = None
    seed_demo_password: str | None = None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
