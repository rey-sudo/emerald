FROM node:22-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN cd node_modules/pulsar-client \
    && npx node-pre-gyp install --fallback-to-build

FROM deps AS builder
WORKDIR /app

COPY . .

RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app

COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8002

CMD ["node", "dist/index.js"]