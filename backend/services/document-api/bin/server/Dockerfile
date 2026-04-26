# ── Etapa 1: Dependencias ──────────────────────────────────
FROM node:20-slim AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copiamos archivos de definición de paquetes
COPY package.json pnpm-lock.yaml ./

# Instalamos todas las dependencias (incluyendo devDeps para compilar)
RUN pnpm install --frozen-lockfile

# ── Etapa 2: Construcción (Build) ─────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .
# Compila TS a JS (normalmente genera una carpeta /dist o /build)
RUN pnpm run build

# ── Etapa 3: Producción (Runtime) ──────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

# Seteamos variables de entorno de producción
ENV NODE_ENV=production
ENV FASTIFY_ADDRESS=0.0.0.0

# Copiamos solo lo necesario desde las etapas anteriores
COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Exponemos el puerto por defecto de Fastify
EXPOSE 8001

# Comando para arrancar la aplicación
CMD ["node", "dist/index.js"]