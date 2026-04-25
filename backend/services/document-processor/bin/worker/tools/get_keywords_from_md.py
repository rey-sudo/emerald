import yake
import re
from pathlib import Path
from keybert import KeyBERT
from markdown import markdown
from bs4 import BeautifulSoup

kw_model = KeyBERT(model='all-MiniLM-L6-v2')

def extraer_sustancial_con_bert(texto_o_lista, top_n=10):
    """
    Extrae keywords sin depender de diccionarios de idioma o listas de stop_words.
    """
    # Unimos la lista de YAKE si es necesario para que BERT analice la relación entre palabras
    contenido = " ".join(texto_o_lista) if isinstance(texto_o_lista, list) else texto_o_lista
    
    # Al poner stop_words=None, la función no necesita saber el idioma.
    # Se basa puramente en la importancia semántica del concepto.
    keywords = kw_model.extract_keywords(
        contenido, 
        keyphrase_ngram_range=(1, 2), # Permite capturar términos compuestos como "Gestión Documental"
        stop_words=None,              # ELIMINADO el idioma para ser universal
        top_n=top_n
    )
    
    # Retornamos solo los strings
    return [kw[0] for kw in keywords]

def extraer_keywords_md(file_path: Path, top_n: int = 10):
    """
    Lee un archivo .md, limpia la sintaxis Markdown y extrae keywords.
    """
    try:
        # 1. Leer el contenido del archivo
        # Usamos utf-8 para asegurar compatibilidad con cualquier idioma
        texto = file_path.read_text(encoding='utf-8')
        
        if not texto.strip():
                    return [] 
        # 2. Limpieza básica de Markdown (opcional pero recomendada)
        # Eliminamos encabezados (#), negritas (*), enlaces y bloques de código
        html = markdown(texto)
        soup = BeautifulSoup(html, "html.parser")
        texto_limpio = soup.get_text(separator=". ")
        
        if len(texto_limpio.strip()) < 10:
            texto_limpio = texto
        # 3. Configuración de YAKE (Agnóstica al idioma)
        # n=2 o 3 es ideal para capturar frases compuestas
        kw_extractor = yake.KeywordExtractor(
            n=2,            # Longitud máxima de la frase
            dedupLim=0.8,   # Evitar palabras muy similares
            top=top_n       # Cantidad de resultados
        )

        # 4. Extraer
        keywords = kw_extractor.extract_keywords(texto_limpio)
        
        keywords_limpias = [kw for kw, score in keywords]
        
        sustancial = extraer_sustancial_con_bert(keywords_limpias)
        
        return sustancial

    except Exception as e:
        return f"Error al procesar el archivo: {e}"

