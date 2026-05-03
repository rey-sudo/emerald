# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

RUN pip install --upgrade pip
RUN pip install --no-cache-dir --prefix=/install \
    "pulsar-client>=3.4.0"


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=builder /install /usr/local

RUN useradd --no-create-home --shell /bin/false worker
USER worker

WORKDIR /app
COPY main.py .

ENTRYPOINT ["python", "main.py"]