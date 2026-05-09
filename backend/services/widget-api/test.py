"""
extract_yjs.py
--------------
Carga un archivo binario .yjs y extrae todo su contenido legible.

Uso:
    python extract_yjs.py <archivo.yjs>

Dependencias:
    pip install pycrdt
"""

import sys
import json
from pathlib import Path

import re
from xml.etree import ElementTree as ET

import pycrdt
from pycrdt import Doc, Text, Array, Map, XmlFragment, XmlElement, XmlText


# ── detección de tipos ─────────────────────────────────────────────────────

def detect_root_types(update: bytes):
    """
    Detecta el tipo real (Text/Array/Map/XmlFragment) de cada clave raíz.

    PROBLEMA: doc.get(key, type=X) NO lanza excepción si el tipo es incorrecto;
    devuelve un wrapper vacío. Por tanto no se puede usar try/except para detectar.

    SOLUCIÓN: doc "sonda" que usa la API Rust interna (_doc) en una transacción
    raw, inspeccionando el contenido real para discriminar tipos. El doc sonda
    se descarta y se usa un doc limpio para extracción con la API Python pública.
    """
    probe = Doc()
    probe.apply_update(update)
    inner = probe._doc

    # Leer claves ANTES de abrir la transacción raw
    keys = list(probe.keys())

    detected = {}
    raw_txn = inner.create_transaction()
    for key in keys:
        m   = inner.get_or_insert_map(raw_txn, key)
        t   = inner.get_or_insert_text(raw_txn, key)
        a   = inner.get_or_insert_array(raw_txn, key)
        xml = inner.get_or_insert_xml_fragment(raw_txn, key)

        if m.keys(raw_txn):
            detected[key] = "Map"
        elif t.get_string(raw_txn):
            detected[key] = "Text"
        elif a.len(raw_txn) > 0:
            detected[key] = "Array"
        else:
            try:
                xml_str = xml.get_string(raw_txn)
                detected[key] = "XmlFragment" if xml_str.strip() else "Empty"
            except Exception:
                detected[key] = "Empty"
    raw_txn.commit()

    return keys, detected


# ── extracción recursiva ───────────────────────────────────────────────────

def extract_value(value):
    """Convierte recursivamente cualquier tipo pycrdt a Python nativo."""
    if isinstance(value, Text):
        return str(value)
    if isinstance(value, Array):
        return [extract_value(item) for item in value]
    if isinstance(value, Map):
        return {k: extract_value(v) for k, v in value.items()}
    if isinstance(value, (XmlFragment, XmlElement, XmlText)):
        return {"_xml": str(value)}
    # Escalares: str, int, float, bool, None
    return value


# ── multiselect ───────────────────────────────────────────────────────────

def extract_multiselects(content: dict) -> list:
    """
    Recorre el contenido extraído del doc .yjs buscando todos los elementos
    <multiSelect> embebidos en los strings XML, y los devuelve ordenados
    por su atributo `order` (numérico).

    Cada elemento devuelto es un dict con:
        order : int   — posición declarada en el atributo order
        id    : str   — identificador del nodo
        color : str   — color HEX asociado
        text  : str   — contenido textual del nodo

    Estrategia:
      - El contenido puede ser dict, list o str con XML crudo.
      - Se recorre recursivamente buscando dicts con '_xml'.
      - Para parsear XML se usa ElementTree; como los fragmentos pueden
        tener múltiples raíces se envuelven en <root> auxiliar.
    """

    def _collect_xml_strings(node) -> list:
        if isinstance(node, str):
            return [node] if node.strip().startswith("<") else []
        if isinstance(node, dict):
            if "_xml" in node:
                # No recursamos dentro de _xml para evitar doble procesamiento
                return [node["_xml"]]
            xmls = []
            for v in node.values():
                xmls.extend(_collect_xml_strings(v))
            return xmls
        if isinstance(node, list):
            result = []
            for item in node:
                result.extend(_collect_xml_strings(item))
            return result
        return []

    def _parse_multiselects(xml_str: str) -> list:
        try:
            root = ET.fromstring(f"<root>{xml_str}</root>")
        except ET.ParseError:
            # Escapar & sueltos y reintentar
            clean = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;)", "&amp;", xml_str)
            try:
                root = ET.fromstring(f"<root>{clean}</root>")
            except ET.ParseError:
                return []

        items = []
        for ms in root.iter("multiSelect"):
            items.append({
                "order": int(ms.get("order", 0)),
                "id":    ms.get("id", ""),
                "color": ms.get("color", ""),
                "text":  (ms.text or "").strip(),
            })
        return items

    all_xml = _collect_xml_strings(content)
    multiselects = []
    for xml_str in all_xml:
        multiselects.extend(_parse_multiselects(xml_str))

    multiselects.sort(key=lambda x: x["order"])
    return multiselects


# ── main ───────────────────────────────────────────────────────────────────

PYCRDT_TYPE = {
    "Text":        Text,
    "Array":       Array,
    "Map":         Map,
    "XmlFragment": XmlFragment,
    "Empty":       Text,
}


def main():
    if len(sys.argv) < 2:
        print("Uso: python extract_yjs.py <archivo.yjs>")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"❌  Archivo no encontrado: {path}")
        sys.exit(1)

    raw = path.read_bytes()
    print(f"📄  Archivo   : {path}")
    print(f"📦  Tamaño    : {len(raw):,} bytes")
    print(f"🔧  pycrdt    : {pycrdt.__version__}")
    print()

    # 1. Detectar tipos con doc sonda
    keys, detected = detect_root_types(raw)

    print(f"🔑  Claves raíz : {keys or '(ninguna)'}")
    for k, t in detected.items():
        print(f"      {k!r:30s} → {t}")
    print()

    if not keys:
        print("⚠️   El documento no tiene claves raíz. Nada que extraer.")
        return

    # 2. Doc limpio para extracción con la API pública
    #    IMPORTANTE: doc fresco; el sonda tiene transacciones Rust internas
    #    que entran en conflicto con la API Python si se reutiliza.
    doc = Doc()
    doc.apply_update(raw)

    content = {}
    for key in keys:
        type_name = detected[key]
        py_type = PYCRDT_TYPE[type_name]
        val = doc.get(key, type=py_type)   # per docs: registra clave + tipo
        content[key] = extract_value(val)

    # 3. Mostrar y guardar
    print("═" * 60)
    print("CONTENIDO EXTRAÍDO")
    print("═" * 60)
    print(json.dumps(content, indent=2, ensure_ascii=False, default=str))

    out = path.with_suffix(".json")
    out.write_text(
        json.dumps(content, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    # 4. Extraer y mostrar multiselects
    multiselects = extract_multiselects(content)
    if multiselects:
        print()
        print("═" * 60)
        print("MULTISELECTS (ordenados)")
        print("═" * 60)
        for ms in multiselects:
            print(f"  [{ms['order']}] id={ms['id']}  color={ms['color']}")
            print(f"       {ms['text'][:120]}{'…' if len(ms['text']) > 120 else ''}")
            print()

        ms_out = path.with_name(path.stem + "_multiselects.json")
        ms_out.write_text(
            json.dumps(multiselects, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"✅  Multiselects guardados en: {ms_out}")
    else:
        print("ℹ️   No se encontraron elementos <multiSelect> en el documento.")

    print()
    print(f"✅  JSON guardado en: {out}")


if __name__ == "__main__":
    main()