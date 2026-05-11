import re
from dotenv import load_dotenv
load_dotenv()

from pathlib import Path
from utils.prompts import Quiz, create_quiz, build_quiz_prompt
from utils.extract_multiselect import extract_multiselect
from utils.extract_text import convert_yjs_to_markdown
from utils.extract_keywords import extract_keywords
from utils.generate_context import summarize_to_three_paragraphs

from langdetect import detect
from botocore.config import Config

import asyncio
import json
import os
import langcodes
import aioboto3
import xml.etree.ElementTree as ET

OUTPUT_PATH = Path("tmp/output")
OUTPUT_PATH.mkdir(parents=True, exist_ok=True)


async def download_s3(s3, doc_id: str) -> bytes:
    try:
        response = await s3.get_object(
            Bucket="documents",
            Key=f"{doc_id}/{doc_id}.yjs"
        )

        data = await response["Body"].read()
        return data

    except s3.exceptions.NoSuchKey:
        raise ValueError(
            f"Original YJS binary not found for doc_id={doc_id}"
        )


def replace_xml_content(file_path, tag, new_text):
    if not new_text:
        return
    
    file_path = Path(file_path)

    if not file_path.exists():
        file_path.write_text("", encoding="utf-8")

    content = file_path.read_text(encoding="utf-8")

    pattern = rf"<{tag}>.*?</{tag}>"

    new_block = f"<{tag}>{new_text}</{tag}>"

    if re.search(pattern, content, flags=re.DOTALL):
        # reemplaza si existe
        content = re.sub(pattern, new_block, content, flags=re.DOTALL)
    else:
        # si no existe, lo agrega
        content += new_block + "\n"

    file_path.write_text(content, encoding="utf-8")

    
async def build_context(s3, doc_id: str, bypass_summary: bool = False):
    try:
        print("Downloading S3 binary...")

        data = await download_s3(s3, doc_id)

        print("Converting YJS to markdown...")
        md = convert_yjs_to_markdown(data)

        print("Extracting keywords...")
        keywords = extract_keywords(md)
        
        detected_language = detect(keywords)
        language = langcodes.Language.get(
            detected_language
        ).display_name()
        
        print("Generating summary...")
        context = summarize_to_three_paragraphs(
            md,
            language,
            bypass=bypass_summary,
            verbose=True,
            request_delay=1.0
        )

        print("Extracting multiselects...")
        multiselects = extract_multiselect(data)

        context_path = OUTPUT_PATH / "context.xml"

        replace_xml_content(
            context_path,
            "LanguageRule",
            language
        )
        replace_xml_content(
            context_path,
            "GeneralContext",
            context
        )
        
        replace_xml_content(
            context_path,
            "GeneralContextKeywords",
            keywords
        )        
        replace_xml_content(
            context_path,
            "QuizContent",
            multiselects
        )             
         
        print(f"Context saved at: {context_path}")

    except FileNotFoundError:
        print("Error: El archivo no existe.")
    except Exception as e:
        print(f"Unexpected error: {e}")


def generate_quiz():
    context_path = OUTPUT_PATH / "context.xml"

    if not context_path.exists():
        raise FileNotFoundError(
            "context.txt no existe. Ejecuta build_context primero."
        )

    with open(context_path, "r", encoding="utf-8") as f:
        context = f.read()

    prompt = build_quiz_prompt(context)

    print("Generating quiz...")

    result: Quiz = create_quiz(prompt, 13_000)

    output_path = OUTPUT_PATH / "questions.json"

    new_questions = result.model_dump()

    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            existing_questions = json.load(f)

        existing_questions.extend(new_questions)

    else:
        existing_questions = new_questions

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            existing_questions,
            f,
            ensure_ascii=False,
            indent=2
        )

    print(f"Quiz guardado en: {output_path}")


async def main():
    session = aioboto3.Session()

    config = Config(
        retries={
            "max_attempts": 3,
            "mode": "standard"
        },
        max_pool_connections=12,
        connect_timeout=5,
        read_timeout=30,
    )

    doc_id = "019e0dba-48e9-707a-a17e-c9aeb3ce5c95"

    async with session.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=os.environ.get("S3_ACCESS_KEY"),
        aws_secret_access_key=os.environ.get("S3_SECRET_KEY"),
        region_name=os.environ.get("S3_REGION"),
        config=config
    ) as s3:

        await build_context(s3, doc_id, True)

    generate_quiz()


if __name__ == "__main__":
    asyncio.run(main())