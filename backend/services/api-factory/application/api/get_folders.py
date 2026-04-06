from uuid import UUID
from pydantic import BaseModel
from typing import List, Optional
from fastapi import Request, HTTPException, status, Query
from .router import router

class FolderResponse(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    name: str
    storage_path: str
    color: str
    document_count: int
    created_at: Optional[int]
    readed_at: Optional[int]
    updated_at: Optional[int]
    deleted_at: Optional[int]
    v: int

@router.get("/get-folders", response_model=List[FolderResponse])
async def get_folders_endpoint(
    request: Request,
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Retrieves a paginated list of folders for a specific user.
    Filters out records that have been soft-deleted (deleted_at IS NULL).
    """
    user_id = "019d2612-a01d-734c-ab63-917106f31187" #TODO: authentication
    
    logger = request.app.state.logger
    pool = request.app.state.pool

    # SQL query to fetch active folders ordered by creation date (newest first)
    query = """
    SELECT 
        id, user_id, status, name, storage_path, color, 
        created_at, readed_at, updated_at, deleted_at, v,
        (
            SELECT COUNT(*)::int 
            FROM documents d 
            WHERE d.folder_id = folders.id 
              AND d.deleted_at IS NULL
        ) AS document_count
    FROM folders
    WHERE user_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
    """

    try:
        async with pool.acquire() as connection:
            # Execute the query and fetch multiple rows
            rows = await connection.fetch(query, user_id, limit, offset)
            
            # Convert asyncpg Record objects to dictionaries for Pydantic parsing
            return [dict(row) for row in rows]

    except Exception as e:
        # Log the internal error for debugging
        logger.error(f"Error retrieving folders for user_id {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while fetching folders"
        )