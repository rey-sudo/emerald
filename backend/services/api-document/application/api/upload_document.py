import asyncio
import logging
import time
import boto3
from botocore.client import Config
from uuid6 import uuid7
from asyncpg import Pool
from asyncpg.exceptions import ForeignKeyViolationError, UniqueViolationError
from fastapi import Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from .router import router
from fastapi import UploadFile, HTTPException, status

ALLOWED_MIME_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/markdown": "md",
    "text/plain": "txt",
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


async def validate_file(file: UploadFile) -> tuple[bytes, str, str]:
    """
    Reads and validates an uploaded file.

    Returns:
        (contents, mime_type, extension)

    Raises:
        HTTPException 415 — unsupported type
        HTTPException 400 — empty file
        HTTPException 413 — exceeds size limit
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Tipo de archivo no permitido: '{file.content_type}'. "
                f"Permitidos: {', '.join(ALLOWED_MIME_TYPES.keys())}"
            ),
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo excede el límite de {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    return contents, file.content_type, ALLOWED_MIME_TYPES[file.content_type]

# ── S3Service ─────────────────────────────────────────────────

class S3Service:
    """
    Async wrapper around a synchronous boto3 S3 client.
    Instantiate once at startup and store in app.state.s3.
    """

    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str) -> None:
        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )

    async def put(self, key: str, body: bytes, content_type: str, metadata: dict) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
                Metadata=metadata,
            ),
        )

    async def delete(self, key: str) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.delete_object(Bucket=self.bucket, Key=key),
        )

    async def compensate(self, key: str, logger: logging.Logger) -> None:
        """
        Best-effort delete used as compensating action.
        Swallows exceptions — the caller is already handling one.
        Orphaned objects are reconciled by the storage cleanup job.
        """
        try:
            await self.delete(key)
            logger.info(f"[S3Service] Compensating DELETE succeeded: {key}")
        except Exception as e:
            logger.error(f"[S3Service] Compensating DELETE failed for '{key}': {e}")


# ── Dependency providers ──────────────────────────────────────

def get_pool(request: Request) -> Pool:
    return request.app.state.pool

def get_s3(request: Request) -> S3Service:
    return request.app.state.s3

def get_logger(request: Request) -> logging.Logger:
    return request.app.state.logger


# ── Schema ────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: str
    folder_id: str
    name: str
    status: str
    storage_path: str
    mime_type: str
    size_bytes: int
    created_at: int


# ── Query ─────────────────────────────────────────────────────

_INSERT = """
INSERT INTO documents (
    id, folder_id, user_id, name, status,
    storage_path, mime_type, size_bytes, created_at, v
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, folder_id, name, status, storage_path, mime_type, size_bytes, created_at;
"""


# ── Helper ────────────────────────────────────────────────────

def _storage_key(user_id: str, folder_id: str, doc_id, ext: str) -> str:
    return f"{user_id}/{folder_id}/{doc_id}.{ext}"


# ── Endpoint ──────────────────────────────────────────────────

@router.post(
    "/upload-document",
    status_code=status.HTTP_201_CREATED,
    response_model=DocumentResponse,
)
async def upload_document(
    file: UploadFile = File(...),
    folder_id: str = Form(...),
    pool: Pool = Depends(get_pool),
    s3: S3Service = Depends(get_s3),
    logger: logging.Logger = Depends(get_logger),
):
    """
    Conservative atomicity strategy:
      1. Upload to SeaweedFS  →  if it fails, DB is untouched.
      2. INSERT into DB       →  if it fails, compensate by deleting from S3.
    """
    contents, mime_type, ext = await validate_file(file)

    user_id    = "019d2612-a01d-734c-ab63-917106f31187"  # TODO: authentication
    doc_id     = uuid7()
    key        = _storage_key(user_id, folder_id, doc_id, ext)
    name       = file.filename or f"document.{ext}"
    created_at = int(time.time() * 1000)

    # ── Phase 1: upload binary ────────────────────────────────
    try:
        await s3.put(
            key=key,
            body=contents,
            content_type=mime_type,
            metadata={
                "document-id":   str(doc_id),
                "folder-id":     folder_id,
                "user-id":       user_id,
                "original-name": name,
            },
        )
        logger.info(f"[upload-document] S3 object written: {key}")
    except Exception as e:
        logger.error(f"[upload-document] SeaweedFS upload failed: {e}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Error al subir el archivo.")

    # ── Phase 2: persist metadata ─────────────────────────────
    async with pool.acquire() as conn:
        try:
            async with conn.transaction():
                row = await conn.fetchrow(
                    _INSERT,
                    doc_id, folder_id, user_id, name,
                    "active", key, mime_type, len(contents), created_at, 0,
                )
                if not row:
                    raise RuntimeError("INSERT RETURNING returned empty.")

        except ForeignKeyViolationError:
            await s3.compensate(key, logger)
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"La carpeta '{folder_id}' no existe.")

        except UniqueViolationError:
            await s3.compensate(key, logger)
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un documento con ese identificador.")

        except HTTPException:
            raise

        except Exception as e:
            logger.error(f"[upload-document] DB insert failed: {e}")
            await s3.compensate(key, logger)
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error al registrar el documento.")

    # TODO: Dispatch Pub/Sub event

    return DocumentResponse(**dict(row))