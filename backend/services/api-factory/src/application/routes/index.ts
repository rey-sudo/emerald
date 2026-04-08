import type { FastifyInstance } from 'fastify';
import { getFoldersHandler } from './get-folders.js';

export async function router(fastify: FastifyInstance) {
  // Definición simple de la ruta
  fastify.get('/get-folders', getFoldersHandler);

}