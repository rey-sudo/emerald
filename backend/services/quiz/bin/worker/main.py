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


async def build_context(s3, doc_id: str):
    try:
        print("Downloading S3 binary...")

        data = await download_s3(s3, doc_id)

        print("Converting YJS to markdown...")
        md = convert_yjs_to_markdown(data)

        print("Generating summary...")
        context = summarize_to_three_paragraphs(
            md,
            verbose=True,
            request_delay=1.0
        )

        print("Extracting keywords...")
        keywords = extract_keywords(md)

        detected_language = detect(keywords)
        language = langcodes.Language.get(
            detected_language
        ).display_name()

        print("Extracting multiselects...")
        multiselects = extract_multiselect(data)

        context_path = OUTPUT_PATH / "context.txt"

        with open(context_path, "w", encoding="utf-8") as f:
            f.write(f"LANGUAGE_RULE: {language}\n\n")
            f.write(f"GENERAL_CONTEXT: {context}\n\n")
            f.write(f"GENERAL_CONTEXT_KEYWORDS: {keywords}\n\n")
            f.write(f"QUIZ_CONTENT: {multiselects}\n\n")

        print(f"Context saved at: {context_path}")

    except FileNotFoundError:
        print("Error: El archivo no existe.")
    except Exception as e:
        print(f"Unexpected error: {e}")


def generate_quiz():
    context_path = OUTPUT_PATH / "context.txt"

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

        await build_context(s3, doc_id)

    # generate_quiz()


if __name__ == "__main__":
    asyncio.run(main())