FROM node:20-slim AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

RUN cd node_modules/.pnpm/pulsar-client@1.17.0/node_modules/pulsar-client \
    && npx node-pre-gyp install --fallback-to-build

FROM deps AS builder
WORKDIR /app
COPY . .

RUN pnpm run build

FROM node:20-slim AS runner
WORKDIR /app

COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8002

CMD ["node", "dist/index.js"]