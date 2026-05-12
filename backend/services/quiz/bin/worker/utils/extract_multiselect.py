import re
from bs4 import BeautifulSoup
from pycrdt import Doc, XmlFragment, Text, Map, Array

MULTISELECT_RE = re.compile(r"<multiSelect\b[^>]*>.*?</multiSelect>", re.DOTALL | re.IGNORECASE)


def int_attr(tag, attr, default=0):
    m = re.search(r'\d+', str(tag.get(attr, "")))
    return int(m.group()) if m else default


def parse(strings: list[str]) -> list[dict]:
    soup = BeautifulSoup(" ".join(strings), "html.parser")
    items = {}

    for tag in soup.find_all("multiselect"):
        uid = tag.get("id", "").strip()
        if not uid:
            continue

        text = tag.get_text().strip()

        if uid in items:
            items[uid]["text"] += "\n" + text
        else:
            items[uid] = {
                "order": int_attr(tag, "order"),
                "id": uid,
                "color": tag.get("color", "").strip(),
                "text": text,
            }

    return sorted(items.values(), key=lambda x: (x["order"], x["id"]))


def extract_multiselect(raw: bytes) -> str:
    doc = Doc()
    doc.apply_update(raw)

    full_text = ""
    for key in doc.keys():
        for typ in (XmlFragment, Text, Map, Array):
            try:
                full_text += str(doc.get(key, type=typ)).replace('\\"', '"') + "\n"
                break
            except Exception:
                continue

    matches = list(dict.fromkeys(MULTISELECT_RE.findall(full_text)))
    items = parse(matches)
    return "\n\n".join(item["text"] for item in items)