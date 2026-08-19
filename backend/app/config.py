import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application configuration, loaded from environment variables / .env file.

    DATABASE_URL falls back to a local SQLite file if not provided, so the
    project is runnable immediately for a demo without requiring a running
    PostgreSQL server. In a real deployment, DATABASE_URL should point to
    PostgreSQL, e.g.:
        postgresql+psycopg2://user:pass@host:5432/dbname
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "sqlite:///./vndly.db"
    JWT_SECRET_KEY: str = "dev-secret-key-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Outbound email. Leave SMTP_HOST blank to keep notifications switched off:
    # messages are then written to backend/outbox.log instead of being sent, so
    # the feature is demonstrable without credentials and cannot mail anyone by
    # accident. Never commit real credentials - set these in .env only.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
