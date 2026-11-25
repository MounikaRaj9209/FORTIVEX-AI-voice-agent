from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Fortivex AI Sales Voice Agent"
    app_env: str = "development"
    debug: bool = True

    demo_mode: bool = True
    secret_key: str = "fortivex-dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 1440
    algorithm: str = "HS256"

    database_url: str = "sqlite:///./fortivex.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_stt_model: str = "whisper-1"
    openai_tts_model: str = "tts-1"
    openai_tts_voice: str = "alloy"

    company_name: str = "Fortivex Cloud Solutions"
    agent_name: str = "Aria"
    default_language: str = "en"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_live_ai_available(self) -> bool:
        return bool(self.openai_api_key and self.openai_api_key.strip()) and not self.demo_mode


@lru_cache
def get_settings() -> Settings:
    return Settings()
