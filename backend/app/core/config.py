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
    # Connection budget per process: (pool_size + max_overflow) × processes must stay under Postgres
    # max_connections (default 100). 10 per process leaves room for 8 workers plus admin/migration sessions.
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: float = 10.0
    # Max wait for the per-room write lock; past it the request gets a retryable 503 instead of pinning a connection.
    booking_lock_timeout_ms: int = 3000
    # argon2id costs 64 MB per hash; cap parallel hashes per process so a signup burst cannot exhaust RAM.
    password_hash_concurrency: int = 4


@lru_cache
def get_settings() -> Settings:
    return Settings()
