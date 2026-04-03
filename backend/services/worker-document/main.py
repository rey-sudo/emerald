from pathlib import Path
from utils import process_pdf_document,format_html

INPUT_PATH = "input"
OUTPUT_PATH = "output"

user_id = "019d2612-a01d-734c-ab63-917106f31187" 

file_name = "019d35cd-3578-7f69-835a-7ad7f2bbe8ec.pdf"

file_path = Path(INPUT_PATH) / user_id / file_name
output_path = Path(OUTPUT_PATH) / user_id 

#html_path,md_path = process_pdf_document(file_path= file_path, output_path=output_path, file_name=file_name)

#print(html_path,md_path)

html_path = Path('output/019d2612-a01d-734c-ab63-917106f31187/019d35cd-3578-7f69-835a-7ad7f2bbe8ec.html')

format_html(file_path=html_path, output_path=html_path)