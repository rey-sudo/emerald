import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const fastify: FastifyInstance = Fastify({
  logger: true
});

fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
  return { 
    message: 'Hola desde Fastify + TypeScript',
    manager: 'pnpm' 
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();