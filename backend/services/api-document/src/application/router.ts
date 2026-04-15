import { FastifyInstance } from 'fastify';
import { getFoldersHandler } from './get-folders.js';
import { createFolderHandler } from './create-folder.js';

export function router(app: FastifyInstance) {
  app.post("/create-folder", createFolderHandler);
  app.get("/get-folders", getFoldersHandler);
}