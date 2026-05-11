#get binary from S3

#extract entire document
#extract multiSelect
#extract keywords

#PROMPT1 -> context

from typing import List
from dotenv import load_dotenv
load_dotenv()
from pathlib import Path
from utils.prompts import QuestionItem, create_quiz, build_quiz_prompt, questionsAdapter
from utils.extract_multiselect import extract_multiselect
from utils.extract_text import convert_yjs_to_markdown
from utils.extract_keywords import extract_keywords
from utils.generate_context import summarize_to_three_paragraphs
from langdetect import detect, LangDetectException
import langcodes

INPUT_PATH = Path("tmp/input")
OUTPUT_PATH = Path("tmp/output")

def download_S3(ruta_str: str) -> bytes:
    file_path = Path(ruta_str)
    try:
        raw_data = file_path.read_bytes()
        return raw_data
    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")
        raise
    
    
def build_context():
    try:
        binary_path = INPUT_PATH / "019e0dba-48e9-707a-a17e-c9aeb3ce5c95.yjs"
        data = download_S3(binary_path)
        md = convert_yjs_to_markdown(data)
        

        multiselects =  extract_multiselect(data)

        context = summarize_to_three_paragraphs(md, verbose=True, request_delay=1.0)
        keywords = extract_keywords(md)
        
        detected_language = detect(keywords)
        language = langcodes.Language.get(detected_language).display_name()
        
        context_path = OUTPUT_PATH / "context.txt"
        
        with open(context_path, "w", encoding="utf-8") as f:
            f.write(f"LANGUAGE RULE: {language}\n\n")
            f.write(f"GENERAL CONTEXT: {context}\n\n")
            f.write(f"CONTEXT KEYWORDS: {keywords}\n\n")
            f.write(f"QUIZ CONTENT: {multiselects}\n\n")
            
        
    except FileNotFoundError:
        print("Error: El archivo no existe en la ruta especificada.")    
    

def generate_quiz():
    context_path = OUTPUT_PATH / "context.txt"
    
    with open(context_path, "r", encoding="utf-8") as archivo:
        context = archivo.read()
    
    prompt = build_quiz_prompt(context)
    print(prompt)
    
    result: List[QuestionItem] = create_quiz(prompt, 13_000)
    
    json_output = questionsAdapter.dump_json(result, indent=2).decode()
        
    print(json_output)
    
       
    

def main():
    #build_context()
    generate_quiz() 
    
    
main()    