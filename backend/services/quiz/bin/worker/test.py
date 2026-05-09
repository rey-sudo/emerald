#get binary from S3
#extract entire document
#extract multiSelect
#extract keywords
#PROMPT1 -> context

from pathlib import Path
from utils.extract_multiselect import extract_multiselect
from utils.extract_text import extract_raw_text

def main():
    file_path = Path("input/019e0dba-48e9-707a-a17e-c9aeb3ce5c95.yjs")

    try:
        with open(file_path, "rb") as file:
            data = file_path.read_bytes()
            text = extract_raw_text(data)
            multiselect =  extract_multiselect(data)
            
            
        print(f"{text[:200]}")
    except FileNotFoundError:
        print("Error: El archivo no existe en la ruta especificada.")    
    
    

main()    