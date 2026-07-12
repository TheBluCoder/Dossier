from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.messages import ErrorMessages


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # AI providers
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_case_model: str = "gemini-2.5-pro"
    elevenlabs_api_key: str = ""
    elevenlabs_api_base_url: str = "https://api.elevenlabs.io/v1"
    elevenlabs_tts_model: str = "eleven_v3"
    elevenlabs_default_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_masculine_voice_ids: str = "pNInz6obpgDQGcFmaJgB,ErXwobaYiN019PkySvjV,TxGEqnHWrfWFTfGW9XjX,VR6AewLTigWG4xSOukaG"
    elevenlabs_feminine_voice_ids: str = "21m00Tcm4TlvDq8ikWAM,AZnzlk1XvdvUeBnXmlld,EXAVITQu4vr4xnSDxMaL,MF3mGyEYCl7XYWbV9V6O"
    # Model used to design a bespoke per-suspect voice from voice_description
    # (age/accent/timbre casting note) — see services/voice_design.py.
    elevenlabs_voice_design_model: str = "eleven_multilingual_ttv_v2"
    elevenlabs_output_audio_format: str = "pcm_16000"
    elevenlabs_turn_eagerness: str = "eager"
    elevenlabs_turn_timeout_seconds: int = 7
    elevenlabs_session_max_seconds: int = 900
    # v3 only honors 0.0/0.5/1.0 (rounds to nearest) — "Creative", "Natural",
    # "Robust". 0.0 gives the broadest emotional range and the best audio-tag
    # responsiveness, at the cost of occasional hallucinated words.
    elevenlabs_stability: float = 0.0
    elevenlabs_similarity_boost: float = 0.75
    public_api_url: str = ""
    # Backward-compatible name used by the local development setup.
    public_backend_url: str = ""

    # Image generation (Replicate)
    replicate_api_token: str = ""
    replicate_image_model: str = "black-forest-labs/flux-schnell"

    # Media storage — provider-agnostic; see services/storage/. Swap providers
    # by adding a new ImageStorage implementation and pointing this at it.
    storage_provider: str = "cloudinary"  # cloudinary | (future: s3, gcs, local)
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Auth
    dev_auth_bypass: bool = True
    clerk_jwks_url: str = ""
    # Optional but recommended: the Clerk frontend API origin (JWT `iss` claim),
    # e.g. https://your-app.clerk.accounts.dev — enforced when set.
    clerk_issuer: str = ""

    # Deployment environment: development | production. In production the
    # dev auth bypass refuses to boot — one forgotten env var must not turn
    # every visitor into the same user.
    environment: str = "development"

    # Infrastructure
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "investigator_game"
    cors_origins: str = "http://localhost:5173"

    # Gameplay tuning
    max_history_messages: int = 12
    case_min_suspects: int = 3
    case_max_suspects: int = 5
    case_min_evidence: int = 4
    case_max_evidence: int = 6
    # The commission always keeps this many open cases; solved ones are
    # replaced by background Gemini generation.
    case_pool_size: int = 3


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.environment.lower() in ("production", "prod") and settings.dev_auth_bypass:
        raise ValueError(ErrorMessages.DEV_BYPASS_IN_PROD)
    if settings.case_min_suspects < 3:
        raise ValueError(ErrorMessages.CASE_MIN_SUSPECTS_INVALID)
    if settings.case_max_suspects < settings.case_min_suspects:
        raise ValueError(ErrorMessages.CASE_SUSPECT_RANGE_INVALID)
    if settings.case_min_evidence < 1:
        raise ValueError(ErrorMessages.CASE_MIN_EVIDENCE_INVALID)
    if settings.case_max_evidence < settings.case_min_evidence:
        raise ValueError(ErrorMessages.CASE_EVIDENCE_RANGE_INVALID)
    return settings
