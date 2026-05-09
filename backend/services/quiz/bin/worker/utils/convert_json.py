import json

def convertir_a_json_formateado(prompt1):
    """
    Convierte un objeto a JSON con indentación de 4 espacios
    y sin escapar caracteres ASCII.
    
    :param prompt1: Objeto serializable (dict, list, etc.)
    :return: String en formato JSON
    """
    return json.dumps(prompt1, indent=4, ensure_ascii=False)