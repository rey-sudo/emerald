from pathlib import Path
from tools import process_pdf_document,format_html, extract_md_chunk, get_context_from_text

INPUT_PATH = "input"
OUTPUT_PATH = "output"

user_id = "019d2612-a01d-734c-ab63-917106f31187" 

file_name = "019d35cd-3578-7f69-835a-7ad7f2bbe8ec.pdf"

file_path = Path(INPUT_PATH) / user_id / file_name
output_path = Path(OUTPUT_PATH) / user_id 

#html_path, md_path = process_pdf_document(file_path= file_path, output_path=output_path, file_name=file_name)

#format_html(file_path=html_path, output_path=html_path)

md_path = Path('output/019d2612-a01d-734c-ab63-917106f31187/019d35cd-3578-7f69-835a-7ad7f2bbe8ec.md')
        
context_chunk = extract_md_chunk(md_path, 500)

get_context_from_text(context_chunk)