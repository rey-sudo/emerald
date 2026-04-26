import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { S3Client } from "@aws-sdk/client-s3";
import { router } from "./application/router.js";
import { Pool } from "pg";

const settings = {
  s3: {
    endpoint: process.env.S3_ENDPOINT as string,
    accessKey: process.env.S3_ACCESS_KEY as string,
    secretKey: process.env.S3_SECRET_KEY as string,
    region: "us-east-1",
    bucket: process.env.S3_BUCKET as string,
  },
  port: Number(process.env.PORT) || 3000,
};

declare module "fastify" {
  interface FastifyInstance {
    s3: S3Client;
    config: typeof settings;
    pg_pool: Pool;
  }
}

const s3Client = new S3Client({
  endpoint: settings.s3.endpoint,
  region: "us-east-1",
  credentials: {
    accessKeyId: settings.s3.accessKey,
    secretAccessKey: settings.s3.secretKey,
  },
  forcePathStyle: true,
});

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

app.decorate("config", settings);
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
