#get binary from S3

#extract entire document
#extract multiSelect
#extract keywords

#PROMPT1 -> context

from pathlib import Path
from utils.extract_multiselect import extract_multiselect
from utils.extract_text import convert_yjs_to_markdown
from utils.extract_keywords import extract_keywords


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
        
        context = md[:200] #TODO:
        keywords = extract_keywords(md)
        multiselect =  extract_multiselect(data)
        
        
        
        print("==" * 50)
        print(f"CONTEXT: {context}")
        print("==" * 50)
        print(f"KEYWORDS: {keywords}")
        print("==" * 50)
        print(f"CONTENT: {multiselect}")
    except FileNotFoundError:
        print("Error: El archivo no existe en la ruta especificada.")    
    
    
def main():
    run()  
    
    
main()    