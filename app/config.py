import os
from functools import lru_cache

from pydantic import ValidationInfo, field_validator
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

    # Some hosts (e.g. Vercel) set an env var to an empty string rather than
    # leaving it unset when no value is configured, which would otherwise
    # fail float parsing and crash startup. Treat blank as "not set" so the
    # field default above applies.
    @field_validator("fit_margin_ft", "tight_fit_ft", mode="before")
    @classmethod
    def _blank_env_falls_back_to_default(cls, value: object, info: ValidationInfo) -> object:
        if isinstance(value, str) and not value.strip():
            return cls.model_fields[info.field_name].default
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
