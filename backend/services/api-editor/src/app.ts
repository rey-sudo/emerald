import 'dotenv/config';
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { router } from './application/router.js';

export const app = Fastify({ logger: true });
await app.register(fastifyWebsocket);

declare module 'fastify' {
  interface FastifyInstance {
    clients: Set<WebSocket>
  }
}

app.decorate('clients', new Set<WebSocket>())

app.register(router, { prefix: '/api/editor' });