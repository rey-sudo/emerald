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

from config import get_settings
from fastapi import FastAPI
from application import api
from contextlib import asynccontextmanager
from botocore.client import Config
from loguru import logger
import asyncpg
import boto3

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    
    app.state.settings = settings
    app.state.logger = logger
    
    app.state.pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=5,  # Minimum number of open connections
        max_size=20, # Maximum number of concurrent connections
        command_timeout=60
    )
      
    app.state.s3 = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        )
    )
    
    logger.info("Running service")
    yield
    await app.state.pool.close()
    logger.info("Stopping service")

app = FastAPI(
    title=get_settings().app_name,
    version=get_settings().version,
    debug=get_settings().debug,
    lifespan=lifespan,
    ##
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.include_router(api.router)

