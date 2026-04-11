import "dotenv/config";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { router } from "./application/router.js";
import { S3Client } from "@aws-sdk/client-s3";

export const app = Fastify({ logger: true });
await app.register(fastifyWebsocket);

declare module "fastify" {
  interface FastifyInstance {
    clients: Set<WebSocket>;
  }

  interface FastifyInstance {
    s3: S3Client;
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

app.decorate("clients", new Set<WebSocket>());
app.decorate('s3', s3Client);

app.addHook("onClose", async (instance) => {
  instance.s3.destroy();
});

app.register(router, { prefix: "/api/editor" });
