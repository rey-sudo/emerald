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

from fastapi import FastAPI
from config import get_settings
from application import api
from infrastructure import setup_logger, logger
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logger()
    logger.info("Running service")
    yield
    logger.info("Stopping service")
    
app = FastAPI(
    title=get_settings().app_name,
    version=get_settings().version,
    debug=get_settings().debug,
    lifespan=lifespan,
    #
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.include_router(api.router)

