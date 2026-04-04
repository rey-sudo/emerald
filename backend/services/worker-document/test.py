from pathlib import Path
from tools import process_pdf_document,format_html, extract_md_chunk, get_context_from_text, extraer_keywords_md, detect_word_language

INPUT_PATH = "input"
OUTPUT_PATH = "output"

user_id = "019d2612-a01d-734c-ab63-917106f31187" 

file_name = "019d35cd-3578-7f69-835a-7ad7f2bbe8ec.pdf"

mime_type = 'application/pdf'

file_path = Path(INPUT_PATH) / user_id / file_name
output_path = Path(OUTPUT_PATH) / user_id 


def process_pdf() -> bool:
    
    html_path, md_path = process_pdf_document(file_path= file_path, output_path=output_path, file_name=file_name)
    
    format_html(file_path=html_path, output_path=html_path)
    
    return True


def process_document():
    match mime_type:
        case "application/pdf":
            return process_pdf()
        case "text/markdown":
            return "Apagando todo."
        case _:  
            return "Comando no reconocido."
    


process_document()


#

#md_path = Path('output/019d2612-a01d-734c-ab63-917106f31187/019d35cd-3578-7f69-835a-7ad7f2bbe8ec.md')
        


#keywords = extraer_keywords_md(md_path, top_n=200)

#language = detect_word_language(keywords)

#context_chunk = extract_md_chunk(md_path, 500)

# context = get_context_from_text(context_chunk)