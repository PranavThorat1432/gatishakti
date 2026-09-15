from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database. If MONGODB_URI is unset, the app falls back to an in-process
    # mongomock instance so the prototype runs without a real Atlas cluster.
    # This fallback is for local/demo use only -- see README.
    mongodb_uri: str | None = None
    mongodb_db: str = "urban_intelligence"

    cors_origins: str = "http://localhost:5173"

    # Multi-bus fusion -- locked MVP parameters (continuation prompt section 3)
    defect_cluster_radius_meters: float = 25.0
    defect_fusion_window_minutes: float = 30.0
    defect_min_unique_buses: int = 2

    # Media (optional -- degrades gracefully if unset, PRD section "Cloudinary unavailable")
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None

    # LLM (optional -- degrades gracefully if unset, PRD section 14)
    openrouter_api_key: str | None = None
    openrouter_model: str = "openai/gpt-4o-mini"

    # Computer vision (optional -- degrades gracefully, PRD "YOLO model unavailable")
    pothole_model_path: str = "ai/models/best.pt"
    ai_confidence_threshold: float = 0.50

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
