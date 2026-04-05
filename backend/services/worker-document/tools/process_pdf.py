from pathlib import Path
from typing import Any
#from tools import process_pdf_document,format_html, extract_md_chunk, get_context_from_text, extraer_keywords_md, detect_word_language
from loguru import logger
from mypy_boto3_s3 import S3Client
from .process_pdf_document import *
from .format_html import *

async def process_pdf(s3: S3Client, input_path: Path, output_path: Path, payload: Any):  
    bucket = 'documents'
    user_id = payload['user_id']
    internal_name = payload['internal_name']
    storage_path = payload['storage_path']
    
    tmp_input_file_path = input_path / user_id / internal_name
    tmp_output_file_path = output_path / user_id 
    
    tmp_input_file_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_output_file_path.parent.mkdir(parents=True, exist_ok=True)
    
    s3.download_file(
        Bucket=bucket,
        Key=storage_path,     
        Filename=tmp_input_file_path
    )
    
    #Converts original .pdf file to .md and .html
    md_path, html_path = process_pdf_document(file_path=tmp_input_file_path, output_path=tmp_output_file_path, file_name=internal_name)
    
    #Formats the final .html
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
    
    #UPDATE documents AND insert EVENT         

    resultado = {"status": "success", "processed_at": "ahora"}
            
    logger.success("Trabajo finalizado con éxito")   
    
    return resultado 
     
    

    
   









#

#md_path = Path('output/019d2612-a01d-734c-ab63-917106f31187/019d35cd-3578-7f69-835a-7ad7f2bbe8ec.md')
        


#keywords = extraer_keywords_md(md_path, top_n=200)

#language = detect_word_language(keywords)

#context_chunk = extract_md_chunk(md_path, 500)

# context = get_context_from_text(context_chunk)