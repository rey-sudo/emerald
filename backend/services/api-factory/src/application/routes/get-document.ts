import type { FastifyReply, FastifyRequest } from 'fastify';

export async function getDocumentHandler(request: FastifyRequest, reply: FastifyReply) {
  // Simulación de lógica
  return {
    id: "doc_123",
    title: "Manual de pnpm",
    content: "pnpm es eficiente..."
  };
}