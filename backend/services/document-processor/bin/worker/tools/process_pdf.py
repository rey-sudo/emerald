import asyncio
import logging
from pathlib import Path
from botocore.config import Config
import os
import aiofiles
from .process_pdf_document import process_pdf_document
from .format_html import format_html
import aiohttp
import aiofiles
import shutil

INPUT_PATH = Path("tmp/input")
OUTPUT_PATH = Path("tmp/output")

S3_CONFIG = Config(
    signature_version="s3v4",
    s3={"addressing_style": "path"},
)

async def download(s3_session, s3_bucket, storage_path, tmp_path):
    async with s3_session.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=os.environ.get("S3_ACCESS_KEY"),
        aws_secret_access_key=os.environ.get("S3_SECRET_KEY"),
        region_name=os.environ.get("S3_REGION"),
        config=S3_CONFIG,
    ) as s3:
        obj = await s3.get_object(Bucket=s3_bucket, Key=storage_path)
        
        async with obj["Body"] as stream:
            async with aiofiles.open(tmp_path, "wb") as f:
                async for chunk in stream.content.iter_chunked(1024 * 1024):
                    await f.write(chunk)

    return tmp_path

import os

async def upload_to_s3(s3_session, s3_bucket, s3_key, local_path):
    async with s3_session.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=os.environ.get("S3_ACCESS_KEY"),
        aws_secret_access_key=os.environ.get("S3_SECRET_KEY"),
        region_name=os.environ.get("S3_REGION"),
        config=S3_CONFIG,
    ) as s3:
        await s3.upload_file(Filename=str(local_path), Bucket=s3_bucket, Key=s3_key)
    return s3_key 

async def _html_to_y(html_path: Path, y_path: Path) -> Path:
    url = "http://document-processor-tiptap:7001/html-to-y"

    async with aiofiles.open(html_path, mode='r', encoding='utf-8') as f:
        html_content = await f.read()

    payload = {"html": html_content}

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if "application/octet-stream" not in content_type:
                raise ValueError(f"Unexpected Content-Type: {content_type}")
            data = await response.read()

    async with aiofiles.open(y_path, mode='wb') as f:
        await f.write(data)
    
    return y_path
    
async def process_pdf(pool, s3_session, s3_bucket, payload):     
    data = payload['data']
    
    document_id = data['id']
    user_id = data['user_id']
    internal_name = data['internal_name']    
    storage_path = data['storage_path']
    
    tmp_input_file_path = INPUT_PATH / user_id / internal_name
    tmp_input_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    tmp_output_file_path = OUTPUT_PATH / user_id 
    tmp_output_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    file_stem = tmp_input_file_path.stem    
    
    #1. Download the original .pdf file
    await download(s3_session, s3_bucket, storage_path, tmp_input_file_path)
    
    #2. Converts the original .pdf file to .html
    html_path = await asyncio.to_thread(
        process_pdf_document,
        file_path=tmp_input_file_path,
        output_path=tmp_output_file_path,
        file_name=internal_name
    )
    #3. Format the html
    html_path = await asyncio.to_thread(
        format_html,
        file_path=html_path,
        output_path=html_path
    )
    #4. Converts html to y binary
    y_path = tmp_output_file_path / f"{file_stem}.yjs"
    y_path = await _html_to_y(html_path, y_path)
    logging.info(y_path)
    
    html_s3_key = storage_path.replace(".pdf", ".html")
    y_s3_key = storage_path.replace(".pdf", ".yjs")      

    logging.info(f"Subiendo archivos a S3: {html_s3_key} y {y_s3_key}")
    
    await asyncio.gather(
        upload_to_s3(s3_session, s3_bucket, html_s3_key, html_path),
        upload_to_s3(s3_session, s3_bucket, y_s3_key, y_path)
    )

    logging.info("Subida completada con éxito.")    
    
    assert user_id, "Error deleting unused folders"

    for path in (INPUT_PATH / user_id, OUTPUT_PATH / user_id):
        shutil.rmtree(path, ignore_errors=True)
        
    logging.info("Folders tmp borrados")     