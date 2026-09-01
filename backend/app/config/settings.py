from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    
    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    PORT: Optional[int] = None  # Support Render / Cloud dynamic $PORT
    ALLOWED_ORIGINS: str = "https://leak-lens-roan.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
    ALLOW_ORIGIN_REGEX: Optional[str] = r"^https:\/\/.*\.vercel\.app$"
    
    # Database
    MONGODB_URI: Optional[str] = None
    MONGODB_DB_NAME: str = "leaklens"
    
    # Security
    JWT_SECRET: str = "dev-secret-key-change-in-production-32bytesmin"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # AI Provider
    AI_PROVIDER: str = "mock"  # mock, gemini, openai, groq
    AI_API_KEY: Optional[str] = None
    AI_MODEL_NAME: str = "gemini-1.5-flash"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def effective_port(self) -> int:
        return self.PORT if self.PORT is not None else self.BACKEND_PORT

    @property
    def cors_origins(self) -> List[str]:
        base_origins = [
            "https://leak-lens-roan.vercel.app",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        if not self.ALLOWED_ORIGINS:
            return base_origins
        configured = [origin.strip().rstrip("/") for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        for origin in base_origins:
            if origin not in configured:
                configured.append(origin)
        return configured


settings = Settings()
