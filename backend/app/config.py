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

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    TWILIO_VERIFIED_RECIPIENT_PHONE: str = ""
    TWILIO_USE_TRIAL_TEMPLATE: bool = True

    # Standard SMTP Email Settings
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "notifications@vndly-cwm.com"
    SMTP_FROM_NAME: str = "VNDLY Workforce Platform"
    SMTP_ENABLED: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
