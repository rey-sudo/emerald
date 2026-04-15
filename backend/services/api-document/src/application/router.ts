import { FastifyInstance } from 'fastify';
import { getFoldersHandler } from './get-folders.js';

export function router(app: FastifyInstance) {


  app.get("/get-folders", getFoldersHandler);

}