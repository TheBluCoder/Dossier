from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # AI providers
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_case_model: str = "gemini-2.5-pro"
    elevenlabs_api_key: str = ""

    # Auth
    dev_auth_bypass: bool = True
    clerk_jwks_url: str = ""

    # Infrastructure
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "investigator_game"
    cors_origins: str = "http://localhost:5173"

    # Gameplay tuning
    max_history_messages: int = 12


@lru_cache
def get_settings() -> Settings:
    return Settings()
