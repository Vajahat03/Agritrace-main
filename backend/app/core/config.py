import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

import sys
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent
AGENTS_DIR = ROOT_DIR / "agritrace - agents"
if not AGENTS_DIR.exists():
    AGENTS_DIR = ROOT_DIR / "frontend" / "agritrace - agents"

if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgriTrace API Gateway"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Host and Port Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 5000
    
    # CORS Configuration: allow Next.js development and production origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]
    
    # Firebase Configuration
    FIREBASE_PROJECT_ID: str = "agritrace-ab141"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""
    
    # Phase 4 Database Configuration (MongoDB Atlas)
    MONGODB_URI: str = Field(default="", description="MongoDB Atlas connection URI")
    MONGODB_DATABASE: str = Field(default="agritrace", description="MongoDB Atlas database name")
    MONGODB_MIN_POOL_SIZE: int = Field(default=5, description="Minimum connection pool size")
    MONGODB_MAX_POOL_SIZE: int = Field(default=50, description="Maximum connection pool size")
    MONGODB_TIMEOUT_MS: int = Field(default=5000, description="Server selection and connection timeout in milliseconds")
    AUTO_MIGRATE_ON_STARTUP: bool = Field(default=True, description="Automatically migrate legacy store records if MongoDB is connected")
    PERSISTENCE_MODE: str = Field(default="mongodb", description="Authoritative persistence mode: 'mongodb' or 'local'")
    ALLOW_STORE_FALLBACK: bool = Field(default=False, description="Allow silent in-memory/store.json fallback if MongoDB is unavailable (strictly False in production)")

    # Gemini AI & News API Configuration (loaded from .env)
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key")
    GEMINI_MODEL: str = Field(default="gemini-3.8-flash", description="Gemini model identifier")
    NEWS_API_KEY: str = Field(default="", description="News API key for agricultural topics")
    AI_SERVICE_URL: str = Field(default="https://vajahat03-agritrace-vision-ai.hf.space", description="Hugging Face Space URL for DenseNet-121 Vision AI")

    model_config = SettingsConfigDict(
        env_file=(
            str(BACKEND_DIR / ".env"),
            str(ROOT_DIR / ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

settings = Settings()
