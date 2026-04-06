
import asyncio
import json
import time
from uuid import UUID
from uuid6 import uuid7
from asyncpg.exceptions import ForeignKeyViolationError, UniqueViolationError
from fastapi import File, Form, HTTPException, Request, status, UploadFile
from loguru._logger import Logger
from mypy_boto3_s3 import S3Client
from pydantic import BaseModel
from .router import router

# Map of supported MIME types to their corresponding file extensions
ALLOWED_MIME_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/markdown": "md",
    "text/plain": "txt",
}
# Maximum file size limit: 50 MB
MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 

async def validate_file(file: UploadFile) -> tuple[bytes, str, str]:
    """
    Returns:
        (contents, mime_type, extension)
    Raises:
        HTTPException 415 — unsupported type
        HTTPException 400 — empty file
        HTTPException 413 — exceeds size limit
    """
    # 1. Validate MIME type against the allowed list
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type: '{file.content_type}'. "
                f"Allowed types: {', '.join(ALLOWED_MIME_TYPES.keys())}"
            ),
        )
        
    # 2. Read file content into memory
    contents = await file.read()
    
    # 3. Ensure the file is not empty
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )
        
    # 4. Validate file size
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB limit.",
        )
        
    # 5. Return validated data, MIME type, and the mapped extension
    return contents, file.content_type, ALLOWED_MIME_TYPES[file.content_type]

async def delete_s3_object(s3: S3Client, key: str, bucket: str, logger: Logger) -> None:
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: s3.delete_object(Bucket=bucket, Key=key),
        )     
        
        logger.info(f"[S3Service] Compensating DELETE succeeded: {key}")
    except Exception as e:
        logger.error(f"[S3Service] Compensating DELETE failed for '{key}': {e}")
    
  
# Response schema
class DocumentResponse(BaseModel):
    id: UUID
    folder_id: UUID
    original_name: str
    internal_name: str
    content_type: str
    mime_type: str
    size_bytes: int
    storage_path: str      
    created_at: int

def _build_metadata(original_name: str, size_bytes: int, folder_id: str) -> str:
    """
    JSONB metadata stored alongside the document record.
    Extend freely — this column is the right place for future
    fields (page count, language, virus-scan result, etc.)
    without requiring schema migrations.
    """
    return json.dumps({
        "original_name": original_name,
        "size_bytes":    size_bytes,
        "folder_id":     folder_id,
    })


# ── Endpoint ──────────────────────────────────────────────────

@router.post(
    "/upload-file",
    status_code=status.HTTP_201_CREATED,
    response_model=DocumentResponse,
)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    folder_id: str = Form(...)
):
    """
    Rollback flow:
      1. Upload to SeaweedFS  →  if it fails, DB is untouched.
      2. INSERT into DB       →  if it fails, compensate by deleting from S3.
    """
    logger = request.app.state.logger
    s3 = request.app.state.s3
    pool = request.app.state.pool  
    bucket = request.app.state.settings.s3_bucket

    logger.info(f"filename={file.filename!r}")
    logger.info(f"content_type={file.content_type!r}")
    logger.info(f"folder_id={folder_id!r}")
        
    contents, raw_content_type, ext = await validate_file(file)

    user_id       = "019d2612-a01d-734c-ab63-917106f31187"  # TODO: authentication
    doc_id        = uuid7()
    original_name = file.filename or f"document.{ext}"
    internal_name = f"{doc_id}.{ext}"
    storage_key   = f"{user_id}/{folder_id}/{internal_name}"
    created_at    = int(time.time() * 1000)
    size_bytes   = len(contents)
    metadata      = _build_metadata(original_name, size_bytes, folder_id)
    initial_v = 0
    # content_type  → raw HTTP header value, may include params
    #                 e.g. "application/pdf; name=report.pdf"
    # mime_type     → clean MIME type, no params
    #                 e.g. "application/pdf"
    content_type = raw_content_type
    mime_type    = raw_content_type.split(";")[0].strip()
    
    
    SQL_INSERT = """
    INSERT INTO documents (
        id, user_id, folder_id,
        original_name, internal_name,
        content_type, mime_type,
        size_bytes, storage_path,
        metadata,
        created_at, readed_at, updated_at, deleted_at,
        v
    ) VALUES (
        $1,  $2,  $3,
        $4,  $5,
        $6,  $7,
        $8,  $9,
        $10,
        $11, NULL, NULL, NULL,
        $12
    )
    RETURNING *;
    """

    # ── Phase 1: upload binary ────────────────────────────────
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: s3.put_object(
                Bucket=bucket,
                Key=storage_key,
                Body=contents,
                ContentType=mime_type,
                Metadata={
                "document-id":   str(doc_id),
                "folder-id":     folder_id,
                "user-id":       user_id,
                "original-name": original_name,
                "internal-name": internal_name,
                }
            ),
        )
                
        logger.info(f"[upload-document] S3 object written: {storage_key}")
    except Exception as e:
        logger.error(f"[upload-document] SeaweedFS upload failed: {e}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Error uploading file to S3")

    # ── Phase 2: persist metadata ─────────────────────────────
    async with pool.acquire() as connection:
        try:
            async with connection.transaction():
                row = await connection.fetchrow(
                    SQL_INSERT,
                    doc_id,        # $1  id
                    user_id,       # $2  user_id
                    folder_id,     # $3  folder_id
                    original_name, # $4  original_name
                    internal_name, # $5  internal_name
                    content_type,  # $6  content_type
                    mime_type,     # $7  mime_type
                    size_bytes,    # $8  size_bytes
                    storage_key,   # $9  storage_path
                    metadata,      # $10 metadata
                    
                    created_at,    # $11 created_at
                    initial_v      # $12 v
                )
                if not row:
                    raise RuntimeError("INSERT RETURNING returned empty.")

                data_json = json.dumps(dict(row), default=str)
                metadata = { "user_id": user_id }
                meta_json = json.dumps(metadata or {}, default=str)
                    
                _EVENT_QUERY = """
                INSERT INTO events (
                    specversion, event_type, source, id, time, 
                    entity_type, entity_id, data, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """
                
                await connection.execute(
                    _EVENT_QUERY,
                    0, 
                    'document.created',             
                    'api-document', 
                    uuid7(),                   
                    int(time.time() * 1000),        
                    'document',              
                    str(row["id"]),                
                    data_json,                  
                    meta_json                 
                ) 
                
        except ForeignKeyViolationError:
            await delete_s3_object(s3, storage_key, bucket, logger)
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"The folder '{folder_id}' does not exist.")

        except UniqueViolationError:
            await delete_s3_object(s3, storage_key, bucket, logger)
            raise HTTPException(status.HTTP_409_CONFLICT, "A document with that identifier already exists.")

        except HTTPException:
            raise

        except Exception as e:
            logger.error(f"[upload-document] DB insert failed: {e}")
            await delete_s3_object(s3, storage_key, bucket, logger)
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error registering the document.")

    # TODO: Dispatch Pub/Sub event

    return DocumentResponse(**dict(row))