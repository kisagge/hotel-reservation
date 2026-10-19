from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HARU_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://haru:haru@localhost:5433/haru"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"
    jwt_expire_minutes: int = 1440
    cookie_name: str = "haru_session"
    cors_origins: list[str] = ["http://localhost:3000"]
    upload_dir: str = "uploads"


@lru_cache
def get_settings() -> Settings:
    return Settings()
