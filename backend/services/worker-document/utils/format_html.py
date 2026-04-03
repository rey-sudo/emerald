from bs4 import BeautifulSoup, NavigableString
from pathlib import Path

def format_html(file_path: Path, output_path: Path) -> str:
    print(file_path)
    
    html_plano = file_path.read_text(encoding='utf-8')

    print(html_plano)
    
    soup = BeautifulSoup(html_plano, 'html.parser')
    contenedor = soup.body if soup.body else soup

    # ── 1. Contenido huérfano antes de la primera página ──────────────────────
    primera_pagina = contenedor.find('div', attrs={'data-type': 'page'})

    if primera_pagina:
        nodos_huerfanos = []
        nodo = primera_pagina.previous_sibling
        while nodo:
            nodos_huerfanos.insert(0, nodo)
            nodo = nodo.previous_sibling

        # Solo crear página-0 si hay contenido real (no solo espacios en blanco)
        hay_contenido = any(
            not (isinstance(n, NavigableString) and not n.strip())
            for n in nodos_huerfanos
        )

        if hay_contenido:
            pagina_cero = soup.new_tag('div', attrs={
                'data-type':  'page',
                'data-number': '0',
                'id':          'page-0',
                'class':       'page-virtual',
            })
            primera_pagina.insert_before(pagina_cero)
            for nodo in nodos_huerfanos:
                pagina_cero.append(nodo)

    # ── 2. Empaquetar contenido en cada página ─────────────────────────────────
    for div_pagina in contenedor.find_all('div', attrs={'data-type': 'page'}):
        hermano = div_pagina.next_sibling

        while hermano:
            # Parar al encontrar el siguiente divisor de página
            if hermano.name == 'div' and hermano.get('data-type') == 'page':
                break

            siguiente = hermano.next_sibling
            div_pagina.append(hermano)
            hermano = siguiente

    html_procesado = contenedor.decode_contents()
  
    output_path.write_text(html_procesado, encoding='utf-8')

