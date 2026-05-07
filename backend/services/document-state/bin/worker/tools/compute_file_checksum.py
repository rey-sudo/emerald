import hashlib
from pathlib import Path

def compute_file_checksum(tmp_input_file_path: Path) -> str:
    with open(tmp_input_file_path, "rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()