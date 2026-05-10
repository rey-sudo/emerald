#get binary from S3

#extract entire document
#extract multiSelect
#extract keywords

#PROMPT1 -> context

from dotenv import load_dotenv
load_dotenv()
from pathlib import Path
from utils.extract_multiselect import extract_multiselect
from utils.extract_text import convert_yjs_to_markdown
from utils.extract_keywords import extract_keywords
from utils.generate_context import summarize_to_three_paragraphs

def download_S3(ruta_str: str) -> bytes:
    file_path = Path(ruta_str)
    try:
        raw_data = file_path.read_bytes()
        return raw_data
    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")
        raise
    
    
def run():
    try:
        data = download_S3("input/019e0dba-48e9-707a-a17e-c9aeb3ce5c95.yjs")
        md = convert_yjs_to_markdown(data)
        
        context = summarize_to_three_paragraphs(md, verbose=True, request_delay=2.0)
        keywords = extract_keywords(md)
        multiselect =  extract_multiselect(data)
        
        with open("output.txt", "w", encoding="utf-8") as f:
            f.write(f"CONTEXT: {context}\n")
            f.write("==" * 50 + "\n")
            f.write(f"CONTEXT KEYWORDS: {keywords}\n")        
        
        print("==" * 50)
        print(f"CONTEXT: {context}")
        print("==" * 50)
        print(f"CONTEXT KEYWORDS: {keywords}")
        print("==" * 50)
        print(f"QUIZ CONTENT: {multiselect}")
    except FileNotFoundError:
        print("Error: El archivo no existe en la ruta especificada.")    
    
    
def main():
    run()  
    
    
main()    