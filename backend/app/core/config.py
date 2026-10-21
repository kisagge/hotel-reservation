from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HARU_", env_file=".env", extra="ignore")

    environment: Literal["dev", "test", "prod"] = "dev"
    log_format: Literal["text", "json"] | None = None  # None → json in prod, text otherwise
    database_url: str = "postgresql+psycopg://haru:haru@localhost:5433/haru"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"
    jwt_expire_minutes: int = 1440
    cookie_name: str = "haru_session"
    cookie_secure: bool | None = None  # None → Secure in prod, plain in dev (http://localhost)
    cors_origins: list[str] = ["http://localhost:3000"]
    upload_dir: str = "uploads"
    # Connection budget per process: (pool_size + max_overflow) × processes must stay under Postgres
    # max_connections (default 100). 10 per process leaves room for 8 workers plus admin/migration sessions.
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: float = 10.0
    # Max wait for the per-room write lock; past it the request gets a retryable 503 instead of pinning a connection.
    booking_lock_timeout_ms: int = 3000
    # How far ahead guests may book (KST days after today); later dates are 422 DATE_OUT_OF_RANGE.
    booking_horizon_days: int = 365
    # argon2id costs 64 MB per hash; cap parallel hashes per process so a signup burst cannot exhaust RAM.
    password_hash_concurrency: int = 4
    # Auth rate limits (shared across servers via Postgres). Login per email stops credential stuffing against one
    # account; per-IP limits cap total argon2 work. Behind Next's rewrite the backend only sees the Next server,
    # so per-IP acts as a global cap unless a trusted edge (nginx, hosting) overwrites X-Forwarded-For.
    rate_limit_enabled: bool = True
    trust_forwarded_for: bool = False
    login_per_email_limit: int = 10
    login_per_email_window_s: int = 900
    login_per_ip_limit: int = 100
    login_per_ip_window_s: int = 600
    signup_per_ip_limit: int = 30
    signup_per_ip_window_s: int = 600

    @property
    def session_cookie_secure(self) -> bool:
        return self.environment == "prod" if self.cookie_secure is None else self.cookie_secure


@lru_cache
def get_settings() -> Settings:
    return Settings()
