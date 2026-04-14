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

@router.get("/get-folders")
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
        f.id           AS folder_id,
        f.user_id,
        f.name         AS folder_name,
        f.status       AS folder_status,
        f.color,
        f.storage_path AS folder_storage_path,
        f.created_at   AS folder_created_at,
        f.updated_at   AS folder_updated_at,

        COALESCE(
        json_agg(
            json_build_object(
            'id',           d.id,
            'originalName', d.original_name,
            'internalName', d.internal_name,
            'contentType',  d.content_type,
            'mimeType',     d.mime_type,
            'sizeBytes',    d.size_bytes,
            'storagePath',  d.storage_path,
            'status',       d.status,
            'checksum',     d.checksum,
            'context',      d.context,
            'keywords',     d.keywords,
            'metadata',     d.metadata,
            'createdAt',    d.created_at,
            'updatedAt',    d.updated_at
            ) ORDER BY d.created_at DESC
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'
        ) AS documents

    FROM folders f
    LEFT JOIN documents d
            ON d.folder_id = f.id
            AND d.deleted_at IS NULL
    WHERE f.user_id    = $1
        AND f.deleted_at IS NULL
    GROUP BY f.id
    ORDER BY f.created_at DESC;
    """

    try:
        async with pool.acquire() as connection:
            # Execute the query and fetch multiple rows
            rows = await connection.fetch(query, user_id)
            
            # Convert asyncpg Record objects to dictionaries for Pydantic parsing
            return [dict(row) for row in rows]

    except Exception as e:
        # Log the internal error for debugging
        logger.error(f"Error retrieving folders for user_id {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while fetching folders"
        )