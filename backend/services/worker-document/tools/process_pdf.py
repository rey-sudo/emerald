from pathlib import Path
#from tools import process_pdf_document,format_html, extract_md_chunk, get_context_from_text, extraer_keywords_md, detect_word_language
from loguru import logger
from mypy_boto3_s3 import S3Client
from .process_pdf_document import *
from .format_html import *

async def process_pdf(s3: S3Client, input_path: Path, output_path: Path):  
    user_id = "019d2612-a01d-734c-ab63-917106f31187" 
    file_name = "019d35cd-3578-7f69-835a-7ad7f2bbe8ec.pdf"
    file_path = input_path / user_id / file_name
    output_path = output_path / user_id 
    storage_path = "019d2612-a01d-734c-ab63-917106f31187/019d5911-36f6-7c0b-aa00-a58c7aec289f/019d5b40-389f-70cb-a798-fbe85503da8c.pdf"
    
    html_path, md_path = process_pdf_document(file_path= file_path, output_path=output_path, file_name=file_name)
    format_html(file_path=html_path, output_path=html_path)
    
    html_storage = storage_path.replace(".pdf", ".html")
    
    s3.upload_file(
                Filename=md_path, 
                Bucket='documents',      
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