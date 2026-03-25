from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os

ENV = os.getenv("ENV", "dev")

class Settings(BaseSettings):
    # App
    app_name: str = Field(default="api-document", alias="NAME")
    debug: bool = Field(default=False, alias="DEBUG")
    version: str = Field(default="1.0.0", alias="VERSION")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    workers: int = Field(default=1, alias="WORKERS")

    # Gunicorn
    timeout: int = Field(default=120, alias="TIMEOUT")
    graceful_timeout: int = Field(default=30, alias="GRACEFUL_TIMEOUT")
    keep_alive: int = Field(default=5, alias="KEEP_ALIVE")
    
    db_url: str = Field(default="localhost", alias="DB_URL")
 
    model_config = SettingsConfigDict(
        env_file=f".env.{ENV}",   # (.env.dev, .env.prod)
        env_prefix="APP_",        # k8s
        case_sensitive=False,
        extra="ignore"
    )

settings = Settings()

def get_settings() -> Settings:
    return settings