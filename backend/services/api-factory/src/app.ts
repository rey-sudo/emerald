import 'dotenv/config';
import Fastify from 'fastify';
import { router } from './application/routes/index.js';

export const app = Fastify({ logger: true });

app.register(router, { prefix: '/api/factory' });