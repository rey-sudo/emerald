import spacy
import json
import os

# 1. Cargar modelo
try:
    nlp = spacy.load("es_core_news_lg")
except OSError:
    print("Error: Ejecuta 'python -m spacy download es_core_news_sm' en tu terminal.")
    exit()

def procesar_y_guardar(nombre_input, nombre_output):
    tags_interes = ["NOUN", "PROPN"]
    acumulado = set()

    if not os.path.exists(nombre_input):
        print(f"Error: El archivo {nombre_input} no existe.")
        return

    # 2. Leer e iterar
    with open(nombre_input, "r", encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea:
                continue
                
            doc = nlp(linea)
            for token in doc:
                # FILTROS DE LIMPIEZA PROFUNDA
                if (
                    token.pos_ in tags_interes
                    and token.is_alpha          # Solo letras (fuera números y símbolos)
                    and not token.is_stop       # Fuera palabras comunes (el, un, de)
                    and len(token.text) > 3     # Fuera ruidos de 1-3 letras
                ):
                    acumulado.add(token.text.lower())

    # 3. Convertir a lista ordenada
    resultado_final = {"keywords": sorted(list(acumulado))}

    # 4. GUARDAR EN DISCO
    with open(nombre_output, "w", encoding="utf-8") as f_out:
        json.dump(resultado_final, f_out, indent=4, ensure_ascii=False)
    
    print(f"✅ ¡Éxito! Se han guardado {len(acumulado)} keywords en '{nombre_output}'")

# --- EJECUCIÓN ---
procesar_y_guardar("input.md", "keywords_extraidas.json")