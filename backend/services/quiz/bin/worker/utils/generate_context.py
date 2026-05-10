"""
summarizer.py
Résumé en cascade (chunking jerárquico) usando liteLLM router.
Recibe un documento markdown (str o bytes) y retorna 3 párrafos.
"""

from __future__ import annotations
import math
import time
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from typing import Union
from litellm.router import Router
import litellm

model_list = [
    {
        "model_name": "models-1",
        "litellm_params": {
            "model": "gemini/gemini-2.5-flash"
        }
    },
    {
        "model_name": "models-1",
        "litellm_params": {
            "model": "ollama/llama3.2:3b",
            "api_base": "http://localhost:11434"
        }
    }
]

router = Router(model_list=model_list)
# ─────────────────────────────────────────────────────────────────────────────


# ── Constantes ────────────────────────────────────────────────────────────────
CHUNK_CHARS   = 12_000   # ~10-12 páginas por chunk (≈ 3 000 tokens)
MAX_CHUNKS    = 40       # límite de seguridad
MINI_SUMMARY_SENTENCES = 4
# ─────────────────────────────────────────────────────────────────────────────


def _decode(document: Union[str, bytes]) -> str:
    """Acepta str o bytes y devuelve str."""
    if isinstance(document, (bytes, bytearray)):
        return document.decode("utf-8", errors="replace")
    return document


def _split_chunks(text: str, chunk_size: int = CHUNK_CHARS) -> list[str]:
    """
    Divide el texto en chunks respetando saltos de línea.
    Nunca corta a mitad de párrafo si puede evitarlo.
    """
    chunks, start = [], 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:])
            break
        # retrocede hasta el último salto de línea doble (párrafo)
        boundary = text.rfind("\n\n", start, end)
        if boundary == -1:
            boundary = text.rfind("\n", start, end)
        if boundary == -1:
            boundary = end
        chunks.append(text[start:boundary])
        start = boundary
    return chunks[:MAX_CHUNKS]

@retry(
    retry=retry_if_exception_type(litellm.RateLimitError),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(5),
)
def _llm(prompt: str, max_tokens: int = 512) -> str:
    """Wrapper mínimo sobre tu router."""
    response = router.completion(
        model="models-1",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def _summarize_chunk(chunk: str, index: int, total: int) -> str:
    """Paso 1 – mini-resumen de cada chunk."""
    prompt = (
        f"Eres un asistente experto en síntesis de textos.\n"
        f"Este es el fragmento {index + 1} de {total} de un documento extenso.\n\n"
        f"---\n{chunk}\n---\n\n"
        f"Escribe exactamente {MINI_SUMMARY_SENTENCES} oraciones que capturen "
        f"las ideas principales de este fragmento. Sin listas, solo prosa continua."
    )
    return _llm(prompt, max_tokens=300)


def _merge_summaries(mini_summaries: list[str]) -> str:
    """Paso 2 – consolida los mini-resúmenes en un resumen intermedio."""
    joined = "\n\n".join(
        f"[Fragmento {i + 1}]: {s}" for i, s in enumerate(mini_summaries)
    )
    prompt = (
        "Tienes los resúmenes de cada sección de un documento extenso.\n\n"
        f"{joined}\n\n"
        "Redacta un resumen intermedio de máximo 300 palabras que integre "
        "todos los fragmentos de forma coherente, eliminando repeticiones. "
        "Sin listas, solo prosa."
    )
    return _llm(prompt, max_tokens=600)


def _final_three_paragraphs(intermediate: str) -> str:
    """Paso 3 – 3 párrafos finales con estructura clara."""
    prompt = (
        "A partir del siguiente resumen de un documento extenso, "
        "redacta EXACTAMENTE 3 párrafos bien desarrollados:\n\n"
        f"{intermediate}\n\n"
        "Estructura obligatoria:\n"
        "  Párrafo 1 – Contexto y tema central del documento.\n"
        "  Párrafo 2 – Argumentos, hallazgos o contenido principal.\n"
        "  Párrafo 3 – Conclusiones, implicaciones o cierre.\n\n"
        "Sé preciso y claro. Separa cada párrafo con una línea en blanco."
    )
    return _llm(prompt, max_tokens=700)


# ── Función principal ─────────────────────────────────────────────────────────
def summarize_to_three_paragraphs(
    document: Union[str, bytes],
    request_delay: float = 2.0, 
    verbose: bool = False,
) -> str:
    """
    Recibe un documento markdown completo (str o bytes) y retorna
    3 párrafos que lo resumen usando resumen en cascada con liteLLM.

    Args:
        document: Texto completo en markdown (str o bytes UTF-8).
        verbose:  Si True, imprime el progreso en consola.

    Returns:
        String con los 3 párrafos finales separados por línea en blanco.
    """
    text = _decode(document)

    if not text.strip():
        raise ValueError("El documento está vacío.")

    chunks = _split_chunks(text)
    total  = len(chunks)

    if verbose:
        print(f"📄 Documento: {len(text):,} caracteres → {total} chunks")

    # ── Paso 1: mini-resúmenes por chunk ─────────────────────────────────────
    mini_summaries: list[str] = []
    for i, chunk in enumerate(chunks):
        if verbose:
            print(f"  ↳ Resumiendo chunk {i + 1}/{total}…")
        mini_summaries.append(_summarize_chunk(chunk, i, total))
        
        if i < total - 1:
            time.sleep(request_delay)
        
    # ── Paso 2: consolidar (si hay muchos chunks, segunda pasada) ─────────────
    if len(mini_summaries) > 1:
        if verbose:
            print("🔗 Consolidando mini-resúmenes…")
        intermediate = _merge_summaries(mini_summaries)
    else:
        intermediate = mini_summaries[0]

    # ── Paso 3: 3 párrafos finales ────────────────────────────────────────────
    if verbose:
        print("✍️  Generando 3 párrafos finales…")

    result = _final_three_paragraphs(intermediate)

    return result

