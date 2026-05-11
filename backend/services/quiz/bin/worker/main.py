import json
from dotenv import load_dotenv
load_dotenv()
from pathlib import Path
from utils.prompts import Quiz, create_quiz, build_quiz_prompt
from utils.extract_multiselect import extract_multiselect
from utils.extract_text import convert_yjs_to_markdown
from utils.extract_keywords import extract_keywords
from utils.generate_context import summarize_to_three_paragraphs
from langdetect import detect
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
            f.write(f"LANGUAGE_RULE: {language}\n\n")
            f.write(f"GENERAL_CONTEXT: {context}\n\n")
            f.write(f"GENERAL_CONTEXT_KEYWORDS: {keywords}\n\n")
            f.write(f"QUIZ_CONTENT: {multiselects}\n\n")
            
        
    except FileNotFoundError:
        print("Error: El archivo no existe en la ruta especificada.")    
    

def generate_quiz():
    context_path = OUTPUT_PATH / "context.txt"
    
    with open(context_path, "r", encoding="utf-8") as archivo:
        context = archivo.read()
    
    prompt = build_quiz_prompt(context)
    print(prompt)
    
    result: Quiz = create_quiz(prompt, 13_000)
    
    output_path = OUTPUT_PATH / "questions.json"
    new_questions = result.model_dump()

    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            existing_questions = json.load(f)

        existing_questions.extend(new_questions)

    else:
        existing_questions = new_questions

    # guardar actualizado
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            existing_questions,
            f,
            ensure_ascii=False,
            indent=2
        )

    print(f"Guardado en: {output_path}")
       
    

def main():
    #build_context()
    generate_quiz() 
    
    
main()    