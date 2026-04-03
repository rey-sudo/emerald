from pathlib import Path

def extract_md_chunk(file_path: Path, num_lineas: int = 1000) -> str:
    """
    Lee un archivo .md y devuelve las primeras n líneas como un solo string.
    """
    lineas = []
    try:
        # Abrimos el archivo con encoding utf-8 para evitar errores con tildes/ñ
        with file_path.open('r', encoding='utf-8') as archivo:
            for i, linea in enumerate(archivo):
                if i >= num_lineas:
                    break
                lineas.append(linea)
        
        return "".join(lineas)
    
    except FileNotFoundError:
        return "Error: El archivo no existe."
    except Exception as e:
        return f"Error inesperado: {e}"

# Ejemplo de uso:
# ruta = Path("tus_notas.md")
# contenido = extraer_primeras_lineas(ruta)
# print(contenido)