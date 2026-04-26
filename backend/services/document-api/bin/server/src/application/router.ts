import { FastifyInstance } from "fastify";
import { getFoldersHandler } from "./get-folders.js";
import { createFolderHandler } from "./create-folder.js";
import { updateFolderHandler } from "./update-folder.js";
import { deleteFolderHandler } from "./delete-folder.js";
import { uploadFileHandler } from "./upload-file.js";
import { updateDocumentHandler } from "./update-document.js";
import { deleteDocumentHandler } from "./delete-document.js";

export function router(app: FastifyInstance) {
  app.post("/create-folder", createFolderHandler);
  app.patch("/update-folder", updateFolderHandler);
  app.delete("/delete-folder/:id", deleteFolderHandler);
  app.get("/get-folders", getFoldersHandler);
  //============================================================
  app.post("/upload-file", uploadFileHandler);
  app.patch("/update-document", updateDocumentHandler);
  app.delete("/delete-document/:id", deleteDocumentHandler);
  //============================================================
}
