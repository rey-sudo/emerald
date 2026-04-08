FROM rust:slim-bookworm AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY Cargo.toml Cargo.lock ./

RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release

COPY . .

RUN touch src/main.rs && cargo build --release

# ── Stage Deno ──────────────────────────────────────────────

FROM denoland/deno:latest AS deno-builder

WORKDIR /usr/src/app/server

COPY server/ .

RUN deno compile -A --output binario main.ts

# ── Runtime ─────────────────────────────────────────────────

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /usr/src/app/target/release/consumer /app/consumer

COPY --from=deno-builder /usr/src/app/server/binario /app/binario
RUN chmod +x /app/consumer /app/binario

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]