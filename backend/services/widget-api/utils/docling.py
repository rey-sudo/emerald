from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

def extraer_contexto_completo(ruta_pdf):
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = False
    pipeline_options.accelerator_options.device = "cpu" 

    converter = DocumentConverter(
        format_options={
            "pdf": PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    
    # Procesamos el archivo
    result = converter.convert(ruta_pdf)
    
    # 1. Exportar a Markdown (Ideal para LLMs)
    markdown_content = result.document.export_to_markdown()
    
    # 2. Acceder a tablas como DataFrames (Si necesitas datos puros)
    for i, table in enumerate(result.document.tables):
        df = table.export_to_dataframe()
        print(f"Tabla {i} extraída con éxito.")

    return markdown_content

ruta_salida = "./output/acuerdo-001-2024.md"

# Extraer el contexto
texto_para_ia = extraer_contexto_completo("./input/acuerdo-001-2024.pdf")

# Guardar en archivo .md (Markdown)
with open(ruta_salida, "w", encoding="utf-8") as f:
    f.write(texto_para_ia)

print(f"✅ Proceso finalizado. El contexto se ha guardado en: {ruta_salida}")