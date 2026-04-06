# Emerald
# Copyright (C) 2026 Juan José Caballero Rey
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    env: str = "dev"

    # App
    app_name: str = "api-factory"
    debug: bool = False
    version: str = "1.0.0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    workers: int = 1

    # DB
    database_url: str
    
    s3_endpoint: str 
    s3_access_key: str
    s3_secret_key: str 
    s3_bucket: str 
    
    model_config = SettingsConfigDict(
        env_file=".env.dev",
        case_sensitive=False,
    )

@lru_cache
def get_settings() -> Settings:
    return Settings()