import opendataloader_pdf


opendataloader_pdf.convert(
    input_path=["input/input.pdf"],
    output_dir="output/",
    image_output="off",
    html_page_separator="<div data-type='page' data-number='%page-number%' id='page-%page-number%' class='page-virtual'></div>",
    format="html,markdown",
)