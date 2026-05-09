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


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_raw.py file.yjs")
        sys.exit(1)

    path = Path(sys.argv[1])
    text = decode(path.read_bytes())

    out = path.with_name(f"{path.stem}_raw.txt")
    out.write_text(text, encoding="utf-8")

    print(f"✅ {len(text)} chars → {out}")


if __name__ == "__main__":
    main()