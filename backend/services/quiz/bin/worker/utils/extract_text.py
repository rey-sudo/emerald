from pycrdt import Doc, XmlFragment, Text
from markdownify import markdownify as md

def decode(raw: bytes) -> str:
    doc = Doc()
    doc.apply_update(raw)

    parts = []
    seen = set()

    for key in doc.keys():
        for typ in (XmlFragment, Text):
            try:
                value = str(doc.get(key, type=typ))
            except Exception:
                continue

            if value in seen:
                continue

            seen.add(value)
            parts.append(value)

    return "\n".join(parts)


def convert_yjs_to_markdown(data):
    text = decode(data)
    result = md(text, strip=['a', 'img', 'script', 'style', 'button', 'nav', 'footer'])
    return result