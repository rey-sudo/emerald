import os
from pathlib import Path
import opendataloader_pdf

def process_pdf_document(
    file_path: Path, 
    output_path: Path, 
    file_name: str,
    export_format="html,markdown",
    include_images=False
) :
    """
    Convierte archivos PDF a formatos HTML y Markdown preservando la estructura.
    """
    # Asegurarse de que el directorio de salida existe
    if not os.path.exists(output_path):
        os.makedirs(output_path)
        print(f"Directorio creado: {output_path}")

    # Configuración de la conversión
    image_setting = "on" if include_images else "off"
    
    # Separador de páginas personalizado para el HTML
    page_sep = (
        "<div data-type='page' data-number='%page-number%' "
        "id='page-%page-number%' class='page-virtual'></div>"
    )

    try:     
        opendataloader_pdf.convert(
            input_path=file_path,
            output_dir=output_path,
            image_output=image_setting,
            html_page_separator=page_sep,
            format=export_format,
        )
        
        html_path = output_path / str(Path(file_name).with_suffix(".html"))
        md_path = output_path / str(Path(file_name).with_suffix(".md")) 
          
        return html_path, md_path
        
        
    except Exception as e:
        print(f"Error al procesar los archivos: {e}")

