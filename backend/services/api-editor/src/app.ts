import "dotenv/config";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { router } from "./application/router.js";
import { S3Client } from "@aws-sdk/client-s3";
import { Redis } from "ioredis";
import { Pool } from "pg";

export const app = Fastify({ logger: true });
await app.register(fastifyWebsocket);

declare module "fastify" {
  interface FastifyInstance {
    clients: Set<WebSocket>;
    s3: S3Client;
    redis: Redis;
    pg_pool: Pool;
  }
}

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT as string,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY as string,
    secretAccessKey: process.env.S3_SECRET_KEY as string,
  },
  forcePathStyle: true,
});

const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    });

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.decorate("clients", new Set<WebSocket>());
app.decorate("s3", s3Client);
app.decorate("redis", redisClient);
app.decorate("pg_pool", pgPool);

app.addHook("onClose", async (instance) => {
  await Promise.all([
    instance.s3.destroy(),
    instance.redis.quit(),
    instance.pg_pool.end(),
  ]);
});

app.register(router, { prefix: "/api/editor" });
