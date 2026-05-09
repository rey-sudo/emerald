import sys
from pathlib import Path
from pycrdt import Doc, XmlFragment, Text, Map, Array


def decode(raw: bytes) -> str:
    doc = Doc()
    doc.apply_update(raw)

    parts = []
    seen = set()

    for key in doc.keys():
        for typ in (XmlFragment, Text):  # solo tipos de texto — Map/Array son metadatos
            try:
                value = str(doc.get(key, type=typ))
            except Exception:
                continue

            if value in seen:
                continue

            seen.add(value)
            parts.append(value)

    return "\n".join(parts)


def extract_raw_text(data):
    text = decode(data)
    
    return text