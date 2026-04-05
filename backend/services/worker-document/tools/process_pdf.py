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

from pathlib import Path
from typing import Any
from loguru import logger
from mypy_boto3_s3 import S3Client
from .process_pdf_document import *
from .format_html import *
from uuid6 import uuid7
import asyncpg
import json
import time

async def process_pdf(pool: asyncpg.Pool, s3: S3Client, input_path: Path, output_path: Path, payload: Any):  
    bucket = 'documents'
    document_id = payload['id']
    user_id = payload['user_id']
    internal_name = payload['internal_name']
    storage_path = payload['storage_path']
    
    tmp_input_file_path = input_path / user_id / internal_name
    tmp_output_file_path = output_path / user_id 
    
    tmp_input_file_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_output_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    #1. Download the original .pdf file
    s3.download_file(
        Bucket=bucket,
        Key=storage_path,     
        Filename=tmp_input_file_path
    )
    
    #2. Converts the original .pdf file to .md .html
    md_path, html_path = process_pdf_document(file_path=tmp_input_file_path, output_path=tmp_output_file_path, file_name=internal_name)
    
    #3. Formats the final .html
    format_html(file_path=html_path, output_path=html_path)
    
    #S3 logic ubications
    md_storage = storage_path.replace(".pdf", ".md")
    html_storage = storage_path.replace(".pdf", ".html")
    
    #MARKDOWN upload
    s3.upload_file(
                Filename=md_path, 
                Bucket=bucket,      
                Key=md_storage,           
                ExtraArgs={
                    'ACL': 'private',
                    'ContentType': 'text/markdown',
                    'Metadata': {
                        'autor': 'Juan Perez',
                        'version': '1.0'
                    },
                    'ContentDisposition': 'inline', 
                }
    )
    
    #HTML upload    
    s3.upload_file(
                Filename=html_path, 
                Bucket=bucket,      
                Key=html_storage,           
                ExtraArgs={
                    'ACL': 'private',
                    'ContentType': 'text/html',
                    'Metadata': {
                        'autor': 'Juan Perez',
                        'version': '1.0'
                    },
                    'ContentDisposition': 'inline', 
                }
    )
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            _DOCUMENT_QUERY = """
                UPDATE documents
                SET
                    status     = 'processed',
                    v          = v + 1,
                    updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
                WHERE
                    id         = $1
                    AND deleted_at IS NULL
                RETURNING *
            """
            
            row = await conn.fetchrow(
                _DOCUMENT_QUERY,
                document_id
            ) 
            
            if not row:
                raise RuntimeError("UPDATE RETURNING returned empty.")    
            
            _EVENT_QUERY = """
                INSERT INTO events (
                    specversion, event_type, source, id, time, 
                    entity_type, entity_id, data, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """
            
            data_json = json.dumps(dict(row), default=str)
            meta_json = json.dumps({}, default=str)
            
            await conn.execute(
                _EVENT_QUERY,
                0,              
                'document.updated',                
                'worker-document',            
                uuid7(),               
                int(time.time() * 1000),        
                "document",              
                document_id,                
                data_json,
                meta_json
            )               
    
    resultado = {"status": "success", "processed_at": "ahora"}
            
    logger.success("Trabajo finalizado con éxito")   
    
    return resultado 
     
    

    
   



#

#md_path = Path('output/019d2612-a01d-734c-ab63-917106f31187/019d35cd-3578-7f69-835a-7ad7f2bbe8ec.md')
        


#keywords = extraer_keywords_md(md_path, top_n=200)

#language = detect_word_language(keywords)

#context_chunk = extract_md_chunk(md_path, 500)

# context = get_context_from_text(context_chunk)