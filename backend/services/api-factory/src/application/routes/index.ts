import type { FastifyInstance } from 'fastify';
import { getDocumentHandler } from './get-document.js';

export async function router(fastify: FastifyInstance) {
  // Definición simple de la ruta
  fastify.get('/document', getDocumentHandler);
  
  // Puedes añadir más aquí:
  // fastify.post('/document', createDocumentHandler);
}