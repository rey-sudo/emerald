from pathlib import Path
from collections import Counter
import json
import re
import os

import spacy
import yake
import opendataloader_pdf

from langdetect import detect, LangDetectException

# =========================
# CONFIG
# =========================
INPUT_DIR = Path("input")
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# =========================
# MODELOS DISPONIBLES
# =========================
MODELOS = {
    "es": "es_core_news_lg",
    "en": "en_core_web_lg",
    "pt": "pt_core_news_lg"
}

# cache modelos
modelos_cargados = {}


# =========================
# CARGAR MODELO
# =========================
def obtener_nlp(idioma):

    if idioma not in MODELOS:
        return None

    if idioma not in modelos_cargados:

        try:
            modelos_cargados[idioma] = spacy.load(MODELOS[idioma])
            print(f"✅ Modelo cargado: {MODELOS[idioma]}")

        except OSError:
            print(
                f"❌ Falta instalar el modelo {MODELOS[idioma]}\n"
                f"Ejecuta:\n"
                f"python -m spacy download {MODELOS[idioma]}"
            )
            return None

    return modelos_cargados[idioma]


# =========================
# PDF -> MARKDOWN
# =========================
def convert_pdf_to_markdown(pdf_path):

    opendataloader_pdf.convert(
        input_path=[str(pdf_path)],
        output_dir="output/",
        image_output="off",
        html_page_separator="<div data-type='page' data-number='%page-number%' id='page-%page-number%' class='page-virtual'></div>",
        format="html,markdown",
    )

    md_file = OUTPUT_DIR / f"{pdf_path.stem}.md"

    if not md_file.exists():
        raise FileNotFoundError(
            f"No se generó markdown para {pdf_path.name}"
        )

    return md_file


# =========================
# ESTADISTICAS
# =========================
def word_statistics(text, top_n=100):

    words = re.findall(r"\\w+", text.lower())

    counter = Counter(words)

    return counter


# =========================
# EXTRAER TOKENS SPACY
# =========================
def extract_spacy_keywords(texto):

    tags_interes = ["NOUN", "PROPN", "ADJ", "VERB"]

    acumulado = []

    # Si llega una lista, iteramos directamente
    if isinstance(texto, list):
        lineas = texto
    else:
        lineas = texto.splitlines()

    for linea in lineas:

        linea = str(linea).strip()

        if not linea:
            continue

        try:
            idioma = detect(linea)

        except LangDetectException:
            continue

        nlp = obtener_nlp(idioma)

        if nlp is None:
            continue

        doc = nlp(linea)

        for token in doc:

            if (
                token.pos_ in tags_interes
                and token.is_alpha
                and not token.is_stop
                and len(token.text) > 3
            ):

                acumulado.append(token.lemma_.lower())

    return acumulado



# =========================
# FILTRAR CON YAKE
# YAKE trabaja SOLO sobre
# el output generado por spaCy
# =========================
def filter_keywords_with_yake(spacy_text, top_n=50):

    kw_extractor = yake.KeywordExtractor(
        lan="auto",
        n=2,
        dedupLim=0.9,
        top=top_n * 5,
    )
    
    yake_keywords = kw_extractor.extract_keywords(spacy_text)

    # solo array de strings
    return [
        keyword
        for keyword, score in yake_keywords[:top_n]
    ]


# =========================
# PROCESAMIENTO PRINCIPAL
# =========================
def process_pdf(pdf_path):

    print(f"\n📄 Procesando: {pdf_path.name}")

    # 1. PDF -> MD
    md_path = convert_pdf_to_markdown(pdf_path)

    text = md_path.read_text(encoding="utf-8")

    if not text.strip():
        print("❌ No se pudo extraer texto")
        return

    # 2. spaCy
    spacy_keywords = extract_spacy_keywords(text)

    yakes = filter_keywords_with_yake(text)
    yakes_ = " ".join(yakes)

    yake_keywords = extract_spacy_keywords(yakes_)

    # frecuencia spaCy
    spacy_freq = Counter(spacy_keywords)

    # unir keywords sin repetir
    keywords_finales = set()

    keywords_finales.update(
        keyword
        for keyword, count in spacy_freq.most_common(100)
    )

    keywords_finales.update(yake_keywords)

    # ordenar opcionalmente
    keywords_finales = sorted(keywords_finales)

    output_txt = OUTPUT_DIR / f"{pdf_path.stem}_keywords.txt"

    with open(output_txt, "w", encoding="utf-8") as f:

        for keyword in keywords_finales:
            f.write(f"{keyword}\n")

    print(f"✅ Keywords guardadas en: {output_txt}")


# =========================
# MAIN
# =========================
if __name__ == "__main__":

    pdf_files = list(INPUT_DIR.glob("*.pdf"))

    if not pdf_files:
        print("❌ No se encontraron PDFs en /input")

    else:

        for pdf in pdf_files:
            process_pdf(pdf)
