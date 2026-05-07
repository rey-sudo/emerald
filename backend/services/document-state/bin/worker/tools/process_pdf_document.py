import logging
from pathlib import Path
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import opendataloader_pdf

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=1, max=8),
    retry=retry_if_exception_type(RuntimeError),
    before_sleep=lambda retry_state: logging.warning(
        f"Attempt {retry_state.attempt_number} failed — retrying in {retry_state.next_action.sleep:.1f}s"
    )
)
def process_pdf_document(
    file_path: Path, 
    output_path: Path, 
    file_name: str,
    export_format="html,markdown",
    include_images=False
)-> Path:
    """
    Converts a PDF file to HTML and Markdown formats while preserving document structure.

    Args:
        file_path:      Path to the source PDF file.
        output_path:    Directory where the converted files will be saved.
        file_name:      Name used in error messages to identify the file.
        export_format:  Comma-separated output formats (default: "html,markdown").
        include_images: Whether to extract and include images in the output.

    Returns:
        A tuple of (html_path, md_path) pointing to the generated files.

    Raises:
        FileNotFoundError: If the source PDF does not exist.
        RuntimeError:      If the conversion fails for any reason.
    """
    
    # Validate that the source file exists before attempting conversion
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Create the output directory (including any missing parents) if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)

     # Map the boolean flag to the string value expected by the converter
    image_setting = "on" if include_images else "off"
    
    # HTML page separator injected between pages to preserve page boundaries
    page_sep = (
        "<div data-type='page' data-number='%page-number%' "
        "id='page-%page-number%' class='page-virtual'></div>"
    )

    try:
        #OpenDataLoader PDF includes a built-in sanitizer designed to protect privacy      
        opendataloader_pdf.convert(
            input_path=file_path,
            output_dir=output_path,
            image_output=image_setting,
            html_page_separator=page_sep,
            format=export_format,
        )
        
        # Build output paths from the source file stem (name without extension)
        file_stem = file_path.stem
        html_path = output_path / f"{file_stem}.html"

        return html_path
        
    except Exception as e:
        raise RuntimeError(f"Failed to convert '{file_name}': {e}") from e

