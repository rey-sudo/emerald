# ── Etapa de Compilación (Builder) ──────────────────────────
FROM rust:slim-bookworm AS builder

# Instalamos dependencias de compilación
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# 1. Copiamos manifiestos y pre-compilamos dependencias para cachear capas
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release

# 2. Ahora copiamos el código real
COPY . .

# El 'touch' es necesario porque Docker ve que el archivo 'src/main.rs' 
# ya existe (del paso 1) y Cargo podría pensar que no hay cambios.
RUN touch src/main.rs && cargo build --release

# ── Etapa de Ejecución (Runtime) ────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    # Supervisor es útil si vas a correr varios procesos, 
    # pero para un microservicio puro en K8s podrías omitirlo.
    supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 3. Copiamos el binario desde la etapa builder
# Reemplaza 'nombre_de_tu_binario' por el nombre en tu Cargo.toml
COPY --from=builder /usr/src/app/target/release/consumer /app/worker-bin

# 4. (Opcional) Copiar config de supervisor si realmente lo usas
# COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Inyectamos variables del .env (vía Docker Compose o K8s)
ENV PYTHONUNBUFFERED=1

# Ejecutamos el binario directamente
CMD ["./worker-bin"]