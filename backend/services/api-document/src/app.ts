import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { router } from "./application/router.js";
import { S3Client } from "@aws-sdk/client-s3";

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

const s3Client = new S3Client({
  endpoint: settings.s3.endpoint,
  region: "us-east-1",
  credentials: {
    accessKeyId: settings.s3.accessKey,
    secretAccessKey: settings.s3.secretKey,
  },
  forcePathStyle: true,
});

declare module "fastify" {
  interface FastifyInstance {
    s3: S3Client;
    config: typeof settings;
  }
}

export const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

app.decorate("config", settings);
app.decorate("s3", s3Client);
app.addHook("onClose", async (instance) => {
  instance.s3.destroy();
});
app.register(multipart);
app.register(router, { prefix: "/api/document" });
