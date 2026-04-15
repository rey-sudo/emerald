import { FastifyInstance } from "fastify";
import { getFoldersHandler } from "./get-folders.js";
import { createFolderHandler } from "./create-folder.js";
import { updateFolderHandler } from "./update-folder.js";
import { deleteFolderHandler } from "./delete-folder.js";

export function router(app: FastifyInstance) {
  app.post("/create-folder", createFolderHandler);
  app.patch("/update-folder", updateFolderHandler);
  app.delete("/delete-folder/:id", deleteFolderHandler);
  app.get("/get-folders", getFoldersHandler);
}
