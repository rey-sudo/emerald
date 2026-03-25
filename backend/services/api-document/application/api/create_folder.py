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

import time
from uuid import UUID
from uuid6 import uuid7
from pydantic import BaseModel, Field
from fastapi import Request, HTTPException, status
from .router import router

class FolderCreate(BaseModel):
    name: str = Field(..., max_length=100)
    user_id: UUID

@router.post("/create-folder", status_code=status.HTTP_201_CREATED)
async def create_folder_endpoint(params: FolderCreate, request: Request):
    """
    Endpoint to create a new folder record in the database.
    Generates a unique UUID v7 and sets initial metadata.
    """    
    logger = request.app.state.logger
    
    # 1. Retrieve the database connection pool from the app state
    pool = request.app.state.pool
    
    # 2. Prepare additional metadata and folder properties
    # Using UUID v7 for time-sortable unique identifiers
    folder_id = uuid7()
    folder_status = "created"
    storage_path = f"/storage/{params.user_id}/{folder_id}"
    now_timestamp = int(time.time() * 1000)
    initial_v = 0
    
    # 3. Define the SQL insertion query with a RETURNING clause for the created record
    query = """
    INSERT INTO folders (
        id, user_id, status, name, storage_path, created_at, v
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, name, storage_path, created_at, v;
    """
    
    async with pool.acquire() as connection:
        # Execute the insertion within an atomic transaction
        async with connection.transaction():
            try:
                row = await connection.fetchrow(
                    query,
                    folder_id,
                    params.user_id,
                    folder_status,
                    params.name,
                    storage_path,
                    now_timestamp,
                    initial_v
                )
                
                if not row:
                    raise HTTPException(status_code=500, detail="Error al insertar el registro")
                
                # TODO: Dispatch Pub/Sub event for downstream services
                
                # Return the newly created record as a dictionary
                return dict(row)
                
            except Exception as e:
                # If an error occurs, asyncpg automatically performs a ROLLBACK
                logger.error(f"Database error: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not create the folder in the database"
                )