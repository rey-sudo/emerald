import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { S3Client } from "@aws-sdk/client-s3";
import { router } from "./handlers/router.js";
import { Pool } from "pg";

const config = {
  s3: {
    endpoint: process.env.S3_ENDPOINT!,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
    region: process.env.S3_REGION!,
    bucket: process.env.S3_BUCKET!,
  },
  port: Number(process.env.PORT) || 3000,
};

const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true,
});

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

declare module "fastify" {
  interface FastifyInstance {
    s3: S3Client;
    config: typeof config;
    pg_pool: Pool;
  }
}

export const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

app.decorate("config", config);
app.decorate("s3", s3Client);
app.decorate("pg_pool", pgPool);

app.addHook("onClose", async (instance) => {
  instance.s3.destroy();
});

app.register(multipart, {
  attachFieldsToBody: true,
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

app.register(router, { prefix: "/api/document" });
