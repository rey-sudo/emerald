import re
import sys
import json
from pathlib import Path
from bs4 import BeautifulSoup
from pycrdt import Doc, XmlFragment, Text, Map, Array

def int_attr(tag, attr, default=0):
    m = re.search(r'\d+', str(tag.get(attr, "")))
    return int(m.group()) if m else default

def decode(raw: bytes) -> list[str]:
    doc = Doc()
    doc.apply_update(raw)

    seen = set()
    results = []

    for key in doc.keys():
        for typ in (XmlFragment, Text, Map, Array):
            try:
                value = str(doc.get(key, type=typ)).replace('\\"', '"')  # 👈
            except Exception:
                continue

            if "<multiselect" not in value.lower() or value in seen:
                continue

            seen.add(value)
            results.append(value)

    return results


def parse(strings: list[str]) -> list[dict]:
    """Parsea los tags <multiselect> y devuelve los items ordenados."""
    soup = BeautifulSoup(" ".join(strings), "html.parser")  # 👈 un solo parse
    items = {}

    for tag in soup.find_all("multiselect"):
        uid = tag.get("id", "").strip()
        if not uid or uid in items:
            continue

        items[uid] = {
            "order": int_attr(tag, "order"),
            "id": uid,
            "color": tag.get("color", "").strip(),
            "text": tag.get_text().strip(),
            }

    return sorted(items.values(), key=lambda x: (x["order"], x["id"]))


def extract_multiselect(data):
    items = parse(decode(data))

    for item in items:
        preview = item["text"].replace("\n", " ").strip()[:100]
        print(f"[{item['order']:03}] {item['color']:<10} {preview}")
 



if __name__ == "__main__":
    main()